/*
 * Daybook v2 mockup - Rowan room reference fixture.
 *
 * This file holds the PRD Section 7 reference week: Rowan & Foxes,
 * 12-16 October 2026, five different lesson types, one classroom layout,
 * resource packs, three completed reflections, and two carry-forward
 * decisions. The interface derives its counts, durations, and states
 * from this data.
 */

'use strict'

const ROOM = {
  name: 'Rowan & Foxes',
  cohort: 'Reception',
  children: 32,
  adults: ['Miss Hart', 'Mrs Patel', 'Mr Toone'],
  term: 'Autumn 2, 2026',
  week: 'Week 2 · 12-16 October 2026',
  weekNote: 'Photo consent refreshed for four children. Outdoor tap is fixed.',
  intent: 'Stories, structures, and the number five. Children build, retell, and count with purpose.',
  weekFocus: 'Composition of five. Retelling with voice. Testing what makes a structure strong.',
}

const TYPE_META = {
  maths: { label: 'Guided mathematics', accent: 'blue' },
  story: { label: 'Story and talk', accent: 'coral' },
  outdoor: { label: 'Outdoor inquiry', accent: 'sage' },
  phonics: { label: 'Phonics', accent: 'aubergine' },
  provision: { label: 'Continuous provision', accent: 'ochre' },
}

const LESSONS = [
  {
    id: 'mon', day: 'Monday', date: '12 Oct', time: '9:15', type: 'maths',
    title: 'How many ways can five hide?',
    group: 'Whole class, then six groups',
    intention: 'Children compose and partition five, and say the parts they can see and the parts that hide.',
    threads: ['Composition of five', 'Mathematical talk'],
    listenFor: 'Part and whole language: three and two make five, one more hides.',
    priorNote: 'Friday count-walk: most children counted to five with one-to-one touch. Ada and Rex raced ahead.',
    phases: [
      {
        name: 'Gather on the carpet', minutes: 3,
        children: 'Children sit in a circle and sing the hidden-buttons song.',
        adult: 'Miss Hart shows five buttons, then covers two. Ask: how many hide?',
        notice: 'Who checks by touch and who answers from a known fact.',
      },
      {
        name: 'Hide five in pairs', minutes: 8,
        children: 'Pairs hide five buttons under two cups and say the hidden part.',
        adult: 'Model the sentence: three show, two hide, five in all.',
        notice: 'Pairs that swap roles and test a new split without a prompt.',
      },
      {
        name: 'Record our ways', minutes: 10,
        children: 'Children mark their splits on the part-whole mat in their own way.',
        adult: 'Mrs Patel supports the making table. Accept marks, dots, and numerals.',
        notice: 'Marks that show two parts, in any form.',
      },
      {
        name: 'Share and compare', minutes: 6,
        children: 'Three pairs show a split. The class checks it makes five.',
        adult: 'Ask: did any pair find a way nobody else found?',
        notice: 'Children who recognize a repeated split as the same way.',
      },
      { name: 'Tidy and transition', minutes: 3, children: 'Buttons back in the tin, mats to the tray.', adult: 'Sing the tidy rhyme once.', notice: '' },
    ],
    areas: ['Carpet', 'Making table'],
    reflectionState: 'complete',
  },
  {
    id: 'tue', day: 'Tuesday', date: '13 Oct', time: '9:15', type: 'story',
    title: 'The storm whale: whose voice can we hear?',
    group: 'Whole class, talk pairs',
    intention: 'Children infer how Noi feels and speak in role with a partner.',
    threads: ['Talk for retelling'],
    listenFor: 'Feeling words with a reason: he is lonely because his dad works.',
    priorNote: 'The small-world whale is ready in the water tray. Keep the lights low for the storm page.',
    phases: [
      { name: 'Settle and cover talk', minutes: 4, children: 'Children study the cover and share what they notice.', adult: 'Take three ideas without judging them.', notice: 'Ideas that use the picture as evidence.' },
      { name: 'Read the storm', minutes: 9, children: 'Children listen, then whisper to a partner what Noi should do.', adult: 'Read slowly. Pause on the rescue page.', notice: 'Partners who take turns without a reminder.' },
      { name: 'Speak in role', minutes: 8, children: 'Talk pairs: one is Noi, one is Dad, on the beach at night.', adult: 'Mr Toone models a quiet, worried voice first.', notice: 'Children who give a reason for a feeling.' },
      { name: 'Story map start', minutes: 7, children: 'Children order four story cards on the map.', adult: 'Ask: what happened before the storm?', notice: 'Sequence words: first, then, after.' },
    ],
    areas: ['Carpet', 'Book corner'],
    reflectionState: 'complete',
  },
  {
    id: 'wed', day: 'Wednesday', date: '14 Oct', time: '10:00', type: 'outdoor',
    title: 'Bridge builders: can the cart cross?',
    group: 'Three teams, outdoor yard',
    intention: 'Children build a bridge the loaded cart can cross, test it, and improve it.',
    threads: ['Testing and improving', 'Mathematical talk'],
    listenFor: 'Cause words: it broke because the middle had no leg.',
    priorNote: 'Planks checked for splinters. The gap between the crates is set at cart width plus a hand.',
    phases: [
      { name: 'Set the challenge', minutes: 4, children: 'Teams see the gap, the cart, and the load of conkers.', adult: 'Ask: what must the bridge hold?', notice: 'Children who point at the weak middle.' },
      { name: 'Plan in teams', minutes: 6, children: 'Teams draw a plan on a clipboard and pick materials.', adult: 'Miss Hart asks each team to name their strongest part.', notice: 'Plans that show supports, not only a deck.' },
      { name: 'Build and test', minutes: 12, children: 'Teams build, roll the cart, and watch what bends.', adult: 'Do not rescue a wobble. Ask: where does it bend?', notice: 'Teams that test before the build is finished.' },
      { name: 'Improve one thing', minutes: 8, children: 'Each team changes one part and tests again.', adult: 'Name the change: a leg, a wider plank, a shorter span.', notice: 'Changes that follow the observed failure.' },
      { name: 'Review at the bridges', minutes: 5, children: 'Teams walk the line of bridges and vote for the strongest idea.', adult: 'Ask the winning team: what made it strong?', notice: 'Answers that name a part and a reason.' },
    ],
    areas: ['Outdoor yard'],
    reflectionState: 'complete',
  },
  {
    id: 'thu', day: 'Thursday', date: '15 Oct', time: '9:15', type: 'phonics',
    title: 'Sound detectives: /m/ around our room',
    group: 'Whole class, then four groups',
    intention: 'Children discriminate /m/ at the start of words and form the grapheme in sand.',
    threads: [],
    listenFor: 'The pure sound mmm, not muh.',
    priorNote: 'Sand trays refilled. The object basket has two trick items that do not start with /m/.',
    phases: [
      { name: 'Mouth moves warm-up', minutes: 3, children: 'Children copy quiet mouth shapes and find mmm.', adult: 'Keep the sound pure. No vowel after it.', notice: 'Children who hold mmm with lips closed.' },
      { name: 'Hunt for /m/', minutes: 8, children: 'Pairs find one thing in the room that starts with /m/.', adult: 'Mrs Patel plants two decoys and asks pairs to check with the sound.', notice: 'Pairs that reject a decoy and say why.' },
      { name: 'Sort the basket', minutes: 7, children: 'Groups sort objects into /m/ and not /m/.', adult: 'Say the word slowly together before it moves.', notice: 'Self-corrections after saying the word aloud.' },
      { name: 'Write m in sand', minutes: 7, children: 'Children form m in the sand tray: down, over, over.', adult: 'Say the patter together. Accept large, correct movements.', notice: 'Starts at the top, three clear parts.' },
    ],
    areas: ['Carpet', 'Making table'],
    reflectionState: 'placeholder',
  },
  {
    id: 'fri', day: 'Friday', date: '16 Oct', time: '9:00', type: 'provision',
    title: 'The autumn market',
    group: 'Free flow across areas',
    intention: 'Children buy, sell, count, and compare at the class market with real autumn goods.',
    threads: ['Composition of five', 'Talk for retelling'],
    listenFor: 'Counting with purpose: five conkers for one coin, two more make it fair.',
    priorNote: 'Price labels stay under five. The coin pot holds only ones this week.',
    phases: [
      { name: 'Open the market', minutes: 5, children: 'Stallholders lay out leaves, conkers, and cones with price labels.', adult: 'Miss Hart opens the market with the bell.', notice: 'Stallholders who arrange goods in fives.' },
      { name: 'Buy and sell', minutes: 25, children: 'Children shop with counters, make bags of five, and swap roles.', adult: 'Adults shop badly on purpose: offer three for a five-label and see who objects.', notice: 'Fair-trade talk and recounting after a change.' },
      { name: 'Close and count the till', minutes: 8, children: 'Stall teams count their coins in fives on the till mat.', adult: 'Ask: which stall took the most? How do you know?', notice: 'Groupings of five with a spoken total.' },
    ],
    areas: ['Market stall', 'Making table', 'Number pebbles'],
    reflectionState: 'placeholder',
  },
]

const LAYOUT = {
  areas: [
    { id: 'carpet', name: 'Carpet', x: 6, y: 8, w: 30, h: 24, ready: true, invitation: 'Hidden-buttons circle with the five-frame easel.', intention: 'Composition of five in the gather.' },
    { id: 'making', name: 'Making table', x: 40, y: 6, w: 26, h: 18, ready: true, invitation: 'Part-whole mats, buttons, and open mark-making trays.', intention: 'Record splits of five in any form.' },
    { id: 'water', name: 'Water tray', x: 70, y: 6, w: 24, h: 16, ready: false, invitation: 'Storm-whale small world with torch and spray bottle.', intention: 'Retell the rescue with story language.' },
    { id: 'book', name: 'Book corner', x: 70, y: 26, w: 24, h: 20, ready: true, invitation: 'The storm whale with four story cards on the ledge.', intention: 'Sequence and speak in role.' },
    { id: 'construction', name: 'Construction', x: 40, y: 28, w: 26, h: 22, ready: true, invitation: 'Small planks and the challenge card: a bridge for the cart.', intention: 'Indoor rehearsal for the yard build.' },
    { id: 'market', name: 'Market stall', x: 6, y: 36, w: 30, h: 18, ready: false, invitation: 'Empty stall, crates, and blank price labels for Friday setup.', intention: 'Purposeful counting under five.' },
    { id: 'yard', name: 'Outdoor yard', x: 6, y: 58, w: 88, h: 18, ready: true, invitation: 'Crate gap at cart width. Plank store open.', intention: 'Build, test, and improve a bridge.' },
  ],
  adults: [
    { name: 'Miss Hart', route: 'Carpet, then group tables, then the yard at 10:00.' },
    { name: 'Mrs Patel', route: 'Making table all morning. Print run at 8:40.' },
    { name: 'Mr Toone', route: 'Book corner, then the yard for the build.' },
  ],
  transitions: 'Tidy rhyme at each change. Yard door opens only with an adult at the step.',
}

const PACKS = [
  {
    lesson: 'mon', name: 'Five hide pack', ready: true,
    physical: [
      { item: 'Buttons, tin of 90', ready: true },
      { item: 'Paper cups, 32', ready: true },
      { item: 'Feely bags, 6', ready: false },
    ],
    printables: [
      { doc: 'Part-whole mats', size: 'A4', mode: 'Color', copies: 16, queued: true, kind: 'Printable preview' },
      { doc: 'Five frames', size: 'A4', mode: 'Mono', copies: 16, queued: true, kind: 'Printable preview' },
    ],
  },
  {
    lesson: 'tue', name: 'Storm whale pack', ready: true,
    physical: [
      { item: 'The storm whale, book', ready: true },
      { item: 'Whale and boy small world', ready: true },
      { item: 'Torch', ready: true },
    ],
    printables: [
      { doc: 'Story map, four boxes', size: 'A3', mode: 'Mono', copies: 32, queued: true, kind: 'Printable preview' },
    ],
  },
  {
    lesson: 'wed', name: 'Bridge pack', ready: false,
    physical: [
      { item: 'Planks, short, 12', ready: true },
      { item: 'Crates, 8', ready: true },
      { item: 'Cart with conker load', ready: true },
      { item: 'Clipboards and pencils, 6', ready: false },
    ],
    printables: [
      { doc: 'Team plan sheet', size: 'A4', mode: 'Mono', copies: 6, queued: false, kind: 'Printable preview' },
    ],
  },
  {
    lesson: 'thu', name: 'Sound detectives pack', ready: false,
    physical: [
      { item: 'Object basket with two decoys', ready: true },
      { item: 'Sand trays, 8', ready: true },
    ],
    printables: [
      { doc: 'Grapheme m patter cards', size: 'A4', mode: 'Mono', copies: 8, queued: false, kind: 'Printable preview' },
    ],
  },
  {
    lesson: 'fri', name: 'Autumn market pack', ready: false,
    physical: [
      { item: 'Leaves, cones, conkers, three baskets', ready: true },
      { item: 'Counter coins, pot of ones', ready: true },
      { item: 'Till mats, 3', ready: false },
    ],
    printables: [
      { doc: 'Price labels, under five', size: 'A4', mode: 'Color', copies: 4, queued: false, kind: 'Printable preview' },
      { doc: 'Bags of five tally sheet', size: 'A4', mode: 'Mono', copies: 6, queued: false, kind: 'Printable preview' },
    ],
  },
]

const REFLECTIONS = [
  {
    lesson: 'mon', state: 'complete',
    happened: 'Every pair found at least two splits. The sentence stem carried into tidy-up talk. Recording was the hard part: six children drew the buttons but not the two parts.',
    quote: { text: 'Two are sleeping under there. Three and two is five.', child: 'Ada' },
    keep: 'The hidden-buttons song and the pair swap.',
    change: 'Model the mat with a photo of real buttons before the recording phase.',
    tryNext: 'Offer six to the pairs who raced: same cups, one more button.',
    team: { by: 'Mrs Patel', text: 'Making table stayed calm with eight at a time. Keep that cap.' },
    carry: 'Offer six to the fast pairs',
  },
  {
    lesson: 'tue', state: 'complete',
    happened: 'The role-play pairs held the quiet voices longer than expected. Story cards were ordered correctly by most pairs, and the before-the-storm question produced full sentences.',
    quote: { text: 'He is not scared of the whale. He is scared of the quiet house.', child: 'Musa' },
    keep: 'Lights low for the storm page. Whisper-to-partner before any hands up.',
    change: 'Four story cards were too few for the fast finishers. Add a blank fifth card.',
    tryNext: 'Move the whale small world to the water tray for free retelling.',
    team: { by: 'Mr Toone', text: 'Two children asked to keep the book in the corner. Done.' },
    carry: 'Blank fifth story card',
  },
  {
    lesson: 'wed', state: 'complete',
    happened: 'All three bridges failed the first test, which was the point. Two teams added a middle leg without a prompt. The vote went to the wide-plank bridge with a reason given.',
    quote: { text: 'It broke because the middle had no leg. Legs are the strong bit.', child: 'Priya' },
    keep: 'The deliberate first failure and the one-change rule.',
    change: 'The conker load spilled twice. Bag the load.',
    tryNext: 'Bring the pulley to the bridge site and lift the load across.',
    team: null,
    carry: 'Pulley at the bridge site',
  },
  { lesson: 'thu', state: 'placeholder' },
  { lesson: 'fri', state: 'placeholder' },
]

const CARRY_FORWARD = [
  { from: 'Monday reflection', decision: 'Offer six to the fast pairs: same cups, one more button.', to: 'Next week, guided mathematics', attached: true },
  { from: 'Wednesday reflection', decision: 'Bring the pulley to the bridge site and lift the load across.', to: 'Next Wednesday, outdoor inquiry', attached: true },
]

const HALF_TERM = {
  name: 'Autumn 2 · Stories, structures, and five',
  weeks: [
    { n: 1, dates: '5-9 Oct', focus: 'Count with touch. Meet the storm whale.', state: 'past' },
    { n: 2, dates: '12-16 Oct', focus: 'Compose five. Test a structure. Open the market.', state: 'current' },
    { n: 3, dates: '19-23 Oct', focus: 'Six hides too. Retell with the map. Pulley lifts.', state: 'planned' },
    { n: 4, dates: '26-30 Oct', focus: 'Half-term break.', state: 'break' },
    { n: 5, dates: '2-6 Nov', focus: 'Compare five and six. New story voice.', state: 'planned' },
    { n: 6, dates: '9-13 Nov', focus: 'Show what we know: the bridge fair.', state: 'planned' },
  ],
  threads: [
    { name: 'Composition of five', weeks: [2, 3, 5], accent: 'blue' },
    { name: 'Talk for retelling', weeks: [1, 2, 3], accent: 'coral' },
    { name: 'Testing and improving', weeks: [2, 3, 6], accent: 'sage' },
  ],
  library: [
    { name: 'Hidden-buttons number talk', type: 'Guided mathematics', owner: 'Miss Hart', used: 'Used this week' },
    { name: 'Story voices in pairs', type: 'Story and talk', owner: 'Team template', used: 'Used week 1' },
    { name: 'Build, test, improve', type: 'Outdoor inquiry', owner: 'Team template', used: 'Used this week' },
    { name: 'Sound hunt with decoys', type: 'Phonics', owner: 'Mrs Patel', used: 'Used this week' },
  ],
}

if (typeof module !== 'undefined') {
  module.exports = { ROOM, TYPE_META, LESSONS, LAYOUT, PACKS, REFLECTIONS, CARRY_FORWARD, HALF_TERM }
}
