#!/usr/bin/env python3
"""
CAP-PKT-020/021/022 — Real MATLAB Engine worker (CAP-DEC-013).

The Electron desktop process owns the MATLAB boundary. It spawns this script as a
child process and speaks newline-delimited JSON over stdio. One worker == one
app-owned MATLAB session for a single project. The renderer NEVER sees this
process or the engine handle; only the desktop main process does.

Protocol (request on stdin, response on stdout, one JSON object per line):
  {"id": <n>, "cmd": "version"}            -> {"id", "ok": true, "matlabVersion", "toolboxes": [...]}
  {"id": <n>, "cmd": "eval", "expression"} -> {"id", "ok": true, "value": <converted>}
  {"id": <n>, "cmd": "call", "name", "args", "nargout"} -> {"value"}
  {"id": <n>, "cmd": "script", "text"}     -> {"value", "warnings", "console"}
  {"id": <n>, "cmd": "put", "name", "value"}
  {"id": <n>, "cmd": "get", "name"}        -> {"value"}
  {"id": <n>, "cmd": "list"}               -> {"names": [...]}
  {"id": <n>, "cmd": "clear", "names"}
  {"id": <n>, "cmd": "cd", "dir"}
  {"id": <n>, "cmd": "addpath", "dir"}
  {"id": <n>, "cmd": "save", "file", "vars"} -> {"checksum", "matlabVersion"}
  {"id": <n>, "cmd": "load", "file", "vars"} -> {"names": [...]}
  {"id": <n>, "cmd": "shutdown"}

Every response echoes the request id. Failures return
{"id", "ok": false, "code", "message"}. Value conversion only emits JSON-safe
primitives (null / bool / number / string / list / object); anything the engine
returns that cannot be represented that way yields code "UNSUPPORTED_VALUE" so the
desktop side can raise a typed rejection instead of silently stringifying.
"""

import sys
import json
import hashlib
import math


def _fail(code, message):
    return {"ok": False, "code": code, "message": str(message)}


def _import_engine():
    try:
        import matlab.engine  # type: ignore
        import matlab  # type: ignore
        return matlab, matlab.engine
    except Exception as exc:  # noqa: BLE001 - discovery reports the exact reason
        raise RuntimeError("matlab.engine import failed: %s" % exc)


def _to_json_safe(matlab_mod, value):
    """Convert a MATLAB/engine value into a JSON-safe structure.

    Raises ValueError for anything unsupported so the caller emits a typed
    rejection rather than stringifying an opaque object.
    """
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value
    if isinstance(value, (int,)):
        return value
    if isinstance(value, float):
        if math.isfinite(value):
            return value
        raise ValueError("non-finite numeric scalar")
    # MATLAB numeric/logical arrays expose .size and iterate as nested sequences.
    if matlab_mod is not None and isinstance(
        value,
        (
            getattr(matlab_mod, "double", ()),
            getattr(matlab_mod, "single", ()),
            getattr(matlab_mod, "int8", ()),
            getattr(matlab_mod, "int16", ()),
            getattr(matlab_mod, "int32", ()),
            getattr(matlab_mod, "int64", ()),
            getattr(matlab_mod, "uint8", ()),
            getattr(matlab_mod, "uint16", ()),
            getattr(matlab_mod, "uint32", ()),
            getattr(matlab_mod, "uint64", ()),
            getattr(matlab_mod, "logical", ()),
        ),
    ):
        return _matlab_array_to_list(value)
    if isinstance(value, (list, tuple)):
        return [_to_json_safe(matlab_mod, item) for item in value]
    if isinstance(value, dict):
        return {str(k): _to_json_safe(matlab_mod, v) for k, v in value.items()}
    raise ValueError("unsupported MATLAB value of type %s" % type(value).__name__)


def _matlab_array_to_list(value):
    size = list(getattr(value, "size", []) or [])
    flat = [
        (float(x) if not math.isfinite(float(x)) is False else float(x))
        for x in value
    ]
    for x in flat:
        if isinstance(x, float) and not math.isfinite(x):
            raise ValueError("non-finite numeric array element")
    if len(size) <= 2 and (not size or size[0] == 1 or size[1] == 1):
        return flat
    return _reshape(flat, size)


def _reshape(flat, size):
    if len(size) == 1:
        return flat[: size[0]]
    step = 1
    for d in size[1:]:
        step *= d
    out = []
    idx = 0
    for _ in range(size[0]):
        out.append(_reshape(flat[idx : idx + step], size[1:]))
        idx += step
    return out


def main():
    try:
        matlab_mod, engine_mod = _import_engine()
    except Exception as exc:  # noqa: BLE001
        sys.stdout.write(json.dumps({"ready": False, "reason": str(exc)}) + "\n")
        sys.stdout.flush()
        return

    try:
        eng = engine_mod.start_matlab()
    except Exception as exc:  # noqa: BLE001
        sys.stdout.write(json.dumps({"ready": False, "reason": "start_matlab failed: %s" % exc}) + "\n")
        sys.stdout.flush()
        return

    sys.stdout.write(json.dumps({"ready": True}) + "\n")
    sys.stdout.flush()

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except Exception as exc:  # noqa: BLE001
            sys.stdout.write(json.dumps({"id": None, **_fail("BAD_REQUEST", exc)}) + "\n")
            sys.stdout.flush()
            continue

        rid = req.get("id")
        cmd = req.get("cmd")
        resp = {"id": rid, "ok": True}
        try:
            if cmd == "shutdown":
                try:
                    eng.quit()
                except Exception:  # noqa: BLE001
                    pass
                sys.stdout.write(json.dumps({"id": rid, "ok": True}) + "\n")
                sys.stdout.flush()
                return
            elif cmd == "version":
                version = eng.version()
                try:
                    products = eng.matlab.internal.getReleaseInfo() if False else None
                except Exception:  # noqa: BLE001
                    products = None
                toolboxes = []
                try:
                    ver_struct = eng.ver(nargout=1)
                    for entry in ver_struct:
                        name = entry.get("Name") if isinstance(entry, dict) else None
                        if name:
                            toolboxes.append({"name": str(name), "ready": True})
                except Exception:  # noqa: BLE001
                    toolboxes = []
                resp["matlabVersion"] = str(version)
                resp["toolboxes"] = toolboxes
            elif cmd == "eval":
                out = eng.eval(req["expression"], nargout=1)
                resp["value"] = _to_json_safe(matlab_mod, out)
            elif cmd == "call":
                fn = getattr(eng, req["name"])
                args = req.get("args", []) or []
                nargout = int(req.get("nargout", 1))
                out = fn(*args, nargout=nargout)
                resp["value"] = _to_json_safe(matlab_mod, out)
            elif cmd == "script":
                eng.eval(req["text"], nargout=0)
                resp["value"] = None
                resp["warnings"] = []
                resp["console"] = ""
            elif cmd == "put":
                eng.workspace[req["name"]] = req["value"]
            elif cmd == "get":
                resp["value"] = _to_json_safe(matlab_mod, eng.workspace[req["name"]])
            elif cmd == "list":
                names = eng.eval("who", nargout=1)
                resp["names"] = [str(n) for n in names] if names else []
            elif cmd == "clear":
                names = req.get("names")
                if names:
                    eng.eval("clear " + " ".join(str(n) for n in names), nargout=0)
                else:
                    eng.eval("clear", nargout=0)
            elif cmd == "cd":
                eng.cd(req["dir"], nargout=0)
            elif cmd == "addpath":
                eng.addpath(req["dir"], nargout=0)
            elif cmd == "save":
                vars_list = req.get("vars", []) or []
                eng.save(req["file"], *vars_list, nargout=0)
                with open(req["file"], "rb") as handle:
                    digest = hashlib.sha256(handle.read()).hexdigest()
                resp["checksum"] = digest
                resp["matlabVersion"] = str(eng.version())
            elif cmd == "load":
                vars_list = req.get("vars", []) or []
                eng.load(req["file"], *vars_list, nargout=0)
                resp["names"] = list(vars_list)
            else:
                resp = {"id": rid, **_fail("UNKNOWN_CMD", "unknown command: %s" % cmd)}
        except ValueError as exc:
            resp = {"id": rid, **_fail("UNSUPPORTED_VALUE", exc)}
        except Exception as exc:  # noqa: BLE001
            resp = {"id": rid, **_fail("MATLAB_ERROR", exc)}

        sys.stdout.write(json.dumps(resp) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
