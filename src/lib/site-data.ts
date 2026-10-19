/**
 * Freeze Point AC Care — the single source of truth for every word on the site.
 *
 * This is a demonstration brand built to show a client what their own site could
 * look like: the phone numbers, address and figures here are illustrative, not a
 * real company's. Change this one file and the page, the estimate form, the chat
 * assistant's brief follows it too — that is deliberate,
 * so the assistant can never tell a visitor something the page disagrees with.
 */
export const business = {
  name: "Freeze Point AC Care",
  shortName: "Freeze Point",
  tagline: "AC Repair & Installation",
  headline: "Cold air, on the day you called.",
  /** Every reference the office quotes back to a customer starts with this. */
  refPrefix: "FP",
  phoneDisplay: "0300 555 0142",
  phoneHref: "tel:+923005550142",
  whatsappHref: "https://wa.me/923005550142",
  landlineDisplay: "(021) 3583 4420",
  landlineHref: "tel:+922135834420",
  city: "Karachi",
  region: "Karachi",
  postalCode: "75350",
  officeAddress: "Shop 14, 1st Floor, Zarar Avenue, Shahrah-e-Faisal, Karachi 75350",
  officeNote: "Walk in for parts and advice",
  hours: [
    { days: "Monday – Friday", time: "9 am – 9 pm" },
    { days: "Saturday", time: "9 am – 9 pm" },
    { days: "Sunday", time: "Emergency call-out only" },
  ],
  established: 2014,
  /** The visit we lead with — never a price. */
  inspectionLine: "Free on-site inspection. Written quote before a single screw moves.",
} as const;

export const stats = [
  { value: "11+", label: "Years working\nin Karachi" },
  { value: "9,400+", label: "Units serviced,\nrepaired and installed" },
  { value: "90-day", label: "Warranty on workmanship,\nin writing" },
] as const;

export const proofPoints = [
  "Licensed technicians, trained on the brands actually sold in Pakistan",
  "Same-day visit for most Karachi areas if we hear from you before 4 pm",
  "Free on-site inspection — a written quote before any work starts",
  "Genuine parts, and the old part stays with you",
  "90-day workmanship warranty on repairs, gas charging and installations",
  "Photos of the fault and the fix on WhatsApp before we leave",
] as const;

/** Marquee of brands the workshop parts for. Names only — no logos, no claims. */
export const brands = [
  "Daikin", "Gree", "PEL", "Orient", "Kenwood", "Haier", "Super Asia", "Airwave", "TCL", "Dawlance",
] as const;

export const services = [
  {
    id: "ac-repair",
    number: "01",
    category: "ANY BRAND, ANY FAULT",
    title: "AC repair",
    description: "Not cooling, tripping the breaker, rattling at night or dripping inside — diagnosed on site, quoted before we touch a screw.",
    image: "/images/ac-repair.jpg",
    alt: "Technician opening the front panel of a wall-mounted split air conditioner in a Karachi home",
    link: "Book a repair",
    detail: "Most AC faults are not mysterious: a choked coil, a failing capacitor, a fan bearing, a loose connection arcing at the terminal. We measure instead of guessing — pressures, current draw, airflow and temperature split — so the part that is actually sick gets replaced and the ones that are fine do not.",
    benefits: ["Fault found and explained on site", "Only the failed part is replaced", "Tested in front of you before we leave", "Old part handed over with the job card"],
  },
  {
    id: "ac-install",
    number: "02",
    category: "NEW OR RELOCATED",
    title: "Installation & relocation",
    description: "Correct bracket, sleeve, pipe run, vacuum and a leak test — and a safe move when you shift house.",
    image: "/images/ac-install.jpg",
    alt: "Two technicians levelling and mounting a split air conditioner indoor unit on a wall",
    link: "Install or shift a unit",
    detail: "An AC is only as good as its installation. A bracket that is not level, a pipe kinked behind the wall or a line that was never evacuated will look fine for one summer and then start eating electricity and losing gas. We do it the slow way once, so you do not pay for it every year.",
    benefits: ["Wall braced, levelled and sleeve-drilled", "Copper flared, insulated and pressure-tested", "Lines evacuated by pump, never by gas", "Rehang and re-test when you move house"],
  },
  {
    id: "ac-gas",
    number: "03",
    category: "LEAK FIRST, GAS SECOND",
    title: "Gas charging & leak repair",
    description: "We find where the charge is escaping, seal it, evacuate the line and charge to the nameplate figure.",
    image: "/images/ac-gas.jpg",
    alt: "Manifold gauge set connected to an outdoor condenser service valve for refrigerant charging",
    link: "Fix the leak, then charge",
    detail: "Refrigerant is not consumed — a unit that needs gas every season has a leak somewhere. Topping it up anyway is the expensive shortcut: you pay twice, and the compressor keeps working low on charge. Soap test, electronic sniffer, the joint opened and re-flared, then a measured charge by weight.",
    benefits: ["Leak located before any gas goes in", "Joints re-flared and re-sealed properly", "Charge measured by weight, not by feel", "Written before/after pressure readings"],
  },
  {
    id: "ac-service",
    number: "04",
    category: "BEFORE SUMMER, NOT DURING",
    title: "Deep service & jet cleaning",
    description: "Coils, blower wheel, filters and drain line pressure-washed, so the unit stops smelling and starts saving units.",
    image: "/images/ac-jetclean.jpg",
    alt: "Technician jet-cleaning the fin coil of an outdoor air conditioning unit on a rooftop",
    link: "Book a deep service",
    detail: "A Karachi unit coats itself in fine dust and salt air faster than most people expect. The indoor coil chokes, the blower wheel gets heavy and unbalanced, the drain silts up — and the compressor runs longer to deliver less cold air. Jet cleaning takes the dirt off both coils and the drain with it, which is why the electricity meter is the thing people notice first.",
    benefits: ["Indoor and outdoor coils washed, not brushed", "Blower wheel pulled and balanced clean", "Drain line flushed and tested with water", "Fin comb, panel refit, readings recorded"],
  },
  {
    id: "ac-inverter",
    number: "05",
    category: "COMPONENT-LEVEL REPAIR",
    title: "Inverter specialist",
    description: "IPM modules, boards, sensors and fan faults repaired at component level — with the board photographed for you.",
    image: "/images/ac-inverter.jpg",
    alt: "Inverter air conditioner power board tested with a multimeter on a workshop bench",
    link: "Test the inverter board",
    detail: "On an inverter the board is the expensive part, and a whole-board swap is often what gets quoted for a single failed transistor, a swollen capacitor or a burnt track. We bench-test the board, replace components where it is safe to, and say plainly when a module has gone past repair — a repaired board that is tested properly is not a gamble.",
    benefits: ["Board benched and tested before any quote", "Component-level when the part allows it", "Genuine spares where a swap is needed", "Bench readings written on the job card"],
  },
  {
    id: "ac-ducted",
    number: "06",
    category: "OFFICES, CLINICS, SHOPS",
    title: "Cassette, ducted & AMC",
    description: "Ceiling cassettes, ducted runs and rooftop packages — plus annual maintenance contracts that beat the summer queue.",
    image: "/images/ac-ducted.jpg",
    alt: "Technician on a ladder servicing ducted air conditioning units above a commercial ceiling",
    link: "Talk about an AMC",
    detail: "Commercial kit fails differently: filters left for months, a belt that was never changed, one zone overcooling while another sweats. An AMC puts the servicing on a calendar instead of in a panic, with the deep clean scheduled in March rather than in the middle of June when every unit in the city is down at once.",
    benefits: ["Two visits a year, one before peak season", "Filter, coil, drain and belt checks logged", "Priority call-out for contract holders", "Per-unit report your facility manager can keep"],
  },
] as const;

export const bookingServices = [
  { value: "ac-repair", label: "AC repair — not cooling or making noise" },
  { value: "ac-install", label: "Installation or relocation" },
  { value: "ac-gas", label: "Gas charging or leak repair" },
  { value: "ac-service", label: "Deep service / jet cleaning" },
  { value: "ac-inverter", label: "Inverter board fault" },
  { value: "ac-ducted", label: "Cassette, ducted or AMC" },
  { value: "not-sure", label: "Not sure yet — need advice" },
] as const;

/** The three steps a customer actually goes through with us. */
export const steps = [
  { icon: "message", title: "Tell us the symptom.", description: "A WhatsApp note or a two-minute call: which unit, what it is doing, since when, and your area of Karachi. That is enough to hold a slot." },
  { icon: "ruler", title: "Free inspection, written quote.", description: "The technician tests pressures, current draw and airflow, then writes down the fault and the price before touching anything. You decide after that." },
  { icon: "file-check", title: "Fixed, tested, handed over.", description: "Most jobs close on the same visit. We re-test with you watching, show you the readings, and leave the 90-day warranty card." },
] as const;

export const faqs = [
  { question: "How quickly can you get to me?", answer: "Same-day for most Karachi areas if your request reaches us before 4 pm, otherwise the next working morning. May and June are the busiest weeks of the year, so the earlier you book, the more say you have over the time slot." },
  { question: "My AC runs but does not cool. What is usually wrong?", answer: "Three things cover most of it: a low charge from a slow leak, a choked indoor coil or filter, or a compressor not getting a full run signal. All three are measurable on site within ten minutes, which is exactly why we inspect before we quote rather than guessing over the phone." },
  { question: "Can you just refill the gas?", answer: "We can, and we will tell you if that is the wrong call. Refrigerant is not burnt up — if the charge is low, somewhere is leaking. Topping up without finding the leak usually means the same complaint twelve weeks later, with a compressor working harder in the meantime." },
  { question: "Why is water dripping from the indoor unit?", answer: "Most often a blocked drain line or an indoor unit that has crept off level; occasionally a frozen coil thawing when the fan slows down. It is a quick fix and worth doing this week, before it stains a ceiling or swells the plaster around it." },
  { question: "Inverter or fixed-speed for Karachi?", answer: "If you run the unit long hours on a stable supply, an inverter earns back its price difference in units consumed. If you run on UPS or generator hours, a fixed-speed unit is cheaper to buy and simpler to repair. We will tell you which fits how you actually use it — not which one has the better margin." },
  { question: "Do you handle commercial and ducted systems?", answer: "Yes — ceiling cassettes, ducted runs and rooftop packages for shops, clinics, offices and restaurants, including annual maintenance contracts that put the deep clean in March instead of in the middle of a June breakdown." },
] as const;

/**
 * Where the vans actually go. One page per area, generated from this list, so a
 * locality page and the assistant can never disagree about coverage: both read
 * the same names. `jobs` are ids from `services`, `nearby` are slugs.
 */
export const serviceAreas = [
  {
    slug: "clifton",
    name: "Clifton",
    label: "Clifton & the seafront blocks",
    blocks: "Blocks 1–9, Boat Basin, Khayaban-e-Ittehad",
    eta: "25–40 min from Shahrah-e-Faisal",
    intro: "Salt air off the sea is the whole story in Clifton. Outdoor coils here pit and choke faster than anywhere else in the city, and a unit that was washed last March is already working harder than it should. Most flats also have one fixed condenser ledge, so the pipe run decides what we can reach.",
    watchFor: "Corroded fin packs, white oxide at the bracket bolts, and drain lines that were routed into a shaft with no clean-out.",
    services: ["ac-service", "ac-gas", "ac-repair"],
    access: "Most buildings need the society's permission slip for a rooftop, and lifts are small — we bring the short ladder and the strap, not a scaffold.",
    faqs: [
      { question: "How often should a Clifton unit be serviced?", answer: "Twice a year is the honest answer on the seafront: once before the season and once after it. Salt and dust build a crust on the outdoor coil that a filter cleaning will not touch, and a crust that thick makes the compressor run long for air that is only lukewarm." },
      { question: "Can you clean the outdoor coil on a Clifton high-rise?", answer: "Where the ledge is reachable from the inside, yes — jet wash, containment sheeting below and a second man on the strap. Where it is not, we say so on the inspection instead of improvising on a ledge, and the options get written down for you." },
      { question: "Why does my gas keep running low in Clifton?", answer: "Salt air eats the joints before it eats the copper. A flare nut that looked fine last year is usually pitted by now, so the leak comes back after a top-up. We open the joint, re-flare it, pressure-test and then charge by weight — that order is the whole job." },
    ],
    nearby: ["dha", "gulshan-e-iqbal", "saddar-shahrah"],
  },
  {
    slug: "dha",
    name: "DHA",
    label: "DHA Karachi, Phases 1–8",
    blocks: "Phases 1–8, including the newer commercial belts",
    eta: "20–35 min from Shahrah-e-Faisal",
    intro: "DHA houses run more units per roof than anywhere else we visit — usually four to seven splits, a few cassettes in the newer shops, and increasingly a ducted run in a rebuilt house. That means faults here are less about the unit and more about how it was installed and what it has been asked to carry.",
    watchFor: "Long pipe runs with no trap at the indoor unit, condensers bolted to a parapet without isolators, and boards swapped on a guess by whoever was there first.",
    services: ["ac-install", "ac-inverter", "ac-ducted"],
    access: "Gate paperwork and a photo ID at the guard post are normal; tell us the phase in the request and we arrive with the right documents instead of waiting at the gate.",
    faqs: [
      { question: "Do you install the unit a shop asked for, or the one that fits?", answer: "We fit what the room needs. On an inspection we size the space — glazing, ceiling height, how many people, what the roof does at 4 pm — and if the unit you picked is too small or wildly oversized, we say so before quoting, with the numbers we used." },
      { question: "A whole-house ducted system — is that your work?", answer: "Yes, service and repair of it. Full duct redesign is a different trade and we will name one rather than learn it on your ceiling. What we do daily is filters, coils, drains, dampers, belt and blower faults, and the rooftop package that feeds the lot." },
      { question: "My inverter board was replaced twice and still trips. Now what?", answer: "Then the board probably was not the fault. A supply that sags when the neighbourhood load rises, or an outdoor fan bearing that is dragging, will kill board after board. We bench-test the board, then read the supply and fan current under load, and put the readings on the job card." },
    ],
    nearby: ["clifton", "saddar-shahrah", "malir"],
  },
  {
    slug: "gulshan-e-iqbal",
    name: "Gulshan-e-Iqbal",
    label: "Gulshan-e-Iqbal & University Road",
    blocks: "Blocks 5–13, University Road, Shahrah-e-Noor",
    eta: "15–30 min from Shahrah-e-Faisal",
    intro: "Dense flats, small balconies and a coil that has never seen water. Gulshan is where we see the most units running on a balcony with the door shut, which is a heat-short-circuit: the condenser re-breathes its own hot air, the pressure climbs and the compressor cuts out by 9 pm — while the bill keeps growing all month.",
    watchFor: "Condenser sharing a closed balcony with the kitchen exhaust, blocked drain lines running into a shaft, and brackets that have crept off level in a soft wall.",
    services: ["ac-repair", "ac-service", "ac-gas"],
    access: "Most buildings here want a time window rather than a day, so we give a two-hour slot on the call and text when the van is 20 minutes out.",
    faqs: [
      { question: "My AC cuts off every evening. Is the compressor gone?", answer: "Usually not. A condenser that cannot breathe trips the unit on high pressure once the balcony air is hot, and a choked coil does the same thing on a milder evening. It reads like a dead compressor and costs a fraction of one, which is exactly why we test pressures before quoting anything." },
      { question: "Water is dripping through my ceiling in a Gulshan flat.", answer: "Switch the unit off at the isolator first, then call. Most often it is a blocked drain line or an indoor unit that has slipped off level, and occasionally a frozen coil thawing inside the wall cavity. Left alone it stains the slab above you and swells the plaster — this is a one-day repair that becomes a renovation if you wait a month." },
      { question: "Do you work in the older blocks with aluminium wiring?", answer: "Yes, and we check the supply before we touch the unit. Aluminium terminations oxidise and a loose connection at the isolator will look exactly like a failed board. Tightening, re-terminating and reading the voltage under load takes ten minutes and saves a lot of guessing." },
    ],
    nearby: ["north-nazimabad", "clifton", "saddar-shahrah"],
  },
  {
    slug: "north-nazimabad",
    name: "North Nazimabad",
    label: "North Nazimabad & Safoora Chowrangi",
    blocks: "Blocks 1–10, Safoora Chowrangi, Larknose",
    eta: "25–40 min from Shahrah-e-Faisal",
    intro: "Houses from the sixties and seventies, rewired more than once, with the AC on whatever circuit had room. In North Nazimabad the fault is very often upstream of the air conditioner: a breaker that has gone soft, an isolator that arcs, or a shared neutral that cannot carry a compressor starting on a hot night.",
    watchFor: "Unfused isolators, breakers rated below the unit's draw, and outdoor units mounted on a protruding slab where wind takes the bracket out of the plaster.",
    services: ["ac-repair", "ac-gas", "ac-service"],
    access: "Narrow lanes mean we park short and walk the tools, so we allow an extra ten minutes rather than keeping you waiting by the door.",
    faqs: [
      { question: "The breaker trips only when the AC starts. What is that?", answer: "Either the breaker has tired out — they do, and a 16A that trips at 12A is a common find here — or the compressor is drawing high on a low supply. A clamp meter tells us which in about two minutes. Replacing a breaker is small work; replacing a compressor because nobody measured is not." },
      { question: "My unit is an old fixed-speed one. Repair it or replace it?", answer: "We measure first. If it still pulls its rated current, holds a charge and throws cold air on a mild evening, cleaning, gas and a new capacitor will carry it another few seasons for a fraction of a replacement. If the efficiency has gone, we show you the readings and say replace — no sermon." },
      { question: "Can you work on window units too?", answer: "Yes — the same coil wash, the same gas work, and the same argument about whether the sleeve has been sealed. Half the noise in a window unit is the case rattling in a gap that was never filled with foam." },
    ],
    nearby: ["gulshan-e-iqbal", "saddar-shahrah", "malir"],
  },
  {
    slug: "malir",
    name: "Malir",
    label: "Malir & the eastern belt",
    blocks: "Rashid Minhas Road, Gulzar-e-Meherban, Jinnah Garden",
    eta: "35–55 min from Shahrah-e-Faisal, longer in afternoon heat",
    intro: "Malir is usually two or three degrees hotter than the seafront, and the units here run from noon to well past midnight. That is a hard life for a condenser and an easy one for a low charge to hide in — the ice on the pipe tells you before the phone rings, if you know to look.",
    watchFor: "Rooftop units in direct sun with no shade and no isolators, long pipe runs that were never evacuated, and coils washed only when the phone stops ringing.",
    services: ["ac-service", "ac-repair", "ac-install"],
    access: "On a May or June afternoon, the honest slot is before 11 am or after 7 pm — we would rather tell you that than be three hours late.",
    faqs: [
      { question: "Is a shade over the outdoor unit worth it?", answer: "In Malir, yes. A simple shade or a slatted screen on the sun side keeps the condenser's inlet air several degrees cooler, which shows up directly in the pressure and the units consumed. It has to leave the coil's airflow alone — a box that traps the hot air is worse than no shade at all." },
      { question: "Ice is forming on the copper pipe. Is that serious?", answer: "It is a symptom, not a fault of its own: either the air is not moving across the coil (filters, blower, a choked indoor coil) or the charge is low. Switch to fan-only to melt it, do not chip it off, and get it looked at — running an inverter on a low charge is how a compressor dies quietly over two seasons." },
      { question: "Do you cover new housing societies on the Malir side?", answer: "Yes, including the plots and row houses coming up towards the airport. New builds are mostly installation work here — brackets, sleeves, pipe runs and an evacuation that most painters skip — and the odd unit that has been running on a line nobody vacuumed." },
    ],
    nearby: ["north-nazimabad", "dha", "saddar-shahrah"],
  },
  {
    slug: "saddar-shahrah",
    name: "Saddar",
    label: "Saddar, Shahrah-e-Faisal & the commercial belt",
    blocks: "Saddar, I.I. Chundrigar Road, Bahadurabad, Kalabat Market",
    eta: "15–30 min from the workshop door",
    intro: "Shops, clinics, offices and restaurants, running on ceiling cassettes and rooftop packages from opening to close. Commercial work here is rarely about one broken unit: it is about a filter nobody has seen in two years, a drain that was never routed, or one zone freezing while the one next to it sweats.",
    watchFor: "Cassettes with a blocked condensate pump, ducted returns sealed against a wall that sweats, and AMCs signed but never actually visited in March.",
    services: ["ac-ducted", "ac-service", "ac-inverter"],
    access: "We work around trade hours as a rule — before opening, after close, or between lunch and dinner on a weekend, with a per-unit report your manager can keep.",
    faqs: [
      { question: "Can you service a shop without closing it?", answer: "Usually yes. Indoor coil work needs the space empty of customers for about twenty minutes, and we schedule that around your quietest hour. A rooftop package or a cassette in a false ceiling can often be done with the shutters open and dust sheeting down." },
      { question: "What does an annual maintenance contract actually include?", answer: "Two visits a year, one in March before the season, with filters, coils, drain, belts, terminations and a current reading logged per unit, plus priority call-out for contract holders and a written report per unit. What it does not include is parts, and we would rather say that on the paper than argue about it in June." },
      { question: "One office is freezing and the next one is hot. Same system?", answer: "Often yes, and it is usually air routing rather than capacity — a damper left shut, a filter sealing one branch, or a return drawing from the wrong space. We survey the runs and show you where the air is actually going before anyone buys another unit." },
    ],
    nearby: ["clifton", "north-nazimabad", "malir"],
  },
] as const;

/**
 * Every locality a Karachi customer might type, with the spellings people actually use.
 * The area pages above are the six we write about; this list is only used to read an
 * answer back correctly ("korangiiii" → "Korangi"), so a visitor is never told their own
 * neighbourhood is invalid. Names are illustrative for this demo brand.
 */
export const karachiAreas = [
  { name: "Clifton", aliases: ["block 1", "block 2", "block 4", "block 5", "block 8", "block 9", "boat basin", "khyaban-e-ittahad", "khiaban-e-ittahad"] },
  {
    name: "DHA",
    aliases: [
      "defence", "defence housing", "dha karachi",
      ...["1", "2", "3", "4", "5", "6", "7", "8"].flatMap((n) => [`dha phase ${n}`, `dha ${n}`, `phase ${n} dha`, `defence phase ${n}`, `dha phase${n}`]),
    ],
  },
  { name: "Gulshan-e-Iqbal", aliases: ["gulshan", "gulshan iqbal", "gulshan e iqbal", "block 5", "block 6", "block 7", "block 10", "block 13", "university road", "shahrah-e-noor"] },
  { name: "North Nazimabad", aliases: ["nazimabad", "north nazim abad", "north nazimabad", "block 1", "block 4", "block 7", "block 10", "safoora", "safoora chowrangi", "larknose"] },
  { name: "Malir", aliases: ["malir cantt", "malir city", "rashid minhas", "gulzar-e-meherban", "jinnah garden", "kda chorsahi"] },
  { name: "Saddar", aliases: ["bolton market", "maryam road", "zainab chowk", "new charkadan", "kharadar", "mithadar"] },
  { name: "Korangi", aliases: ["korangi town", "korangi industrial", "site", "site area", "shah faisal colony", "landhi", "landhhi", "korangi block 5", "gulzar-e-hijri", "mahmabad"] },
  { name: "PECHS", aliases: ["pechhs", "rasool bakery", "shahbaz khoro", "kda scheme 1", "sr-iii"] },
  { name: "Gulistan-e-Johar", aliases: ["johar", "gulistan johar", "block 12", "d10", "maripur road"] },
  { name: "Bahadurabad", aliases: ["yousuf bhandu road", "m.a.jinnah road", "mominabad"] },
  { name: "Federal B Area", aliases: ["federal b", "f b area", "faisal block", "saddar federal b"] },
  { name: "Tariq Road", aliases: ["tariq rd", "bus adda", "regal" ] },
  { name: "Askari", aliases: ["askari 1", "askari 2", "askari 5", "dha askari"] },
  { name: "Firdous", aliases: ["firdous market", "khyaban-e-jinnah"] },
  { name: "Shahrah-e-Faisal", aliases: ["shahrah e faisal", "shraah-e-faisal", "nur bazar", "cantonment", "cantt", "karsaz"] },
  { name: "Lyari", aliases: ["lyari nadi", "bhainta colony", "gagar", "machar colony", "united chowrangi"] },
  { name: "Gizri", aliases: ["gizri block 3", "gulshan gizri"] },
  { name: "Orangi", aliases: ["orangi town", "saddar orangi", "mangoopir"] },
] as const;

/**
 * Testimonials for the demo build. These are written for the portfolio piece, not
 * collected from customers — the section labels them as illustrative on the page, and
 * the footer and privacy dialog say the same. Keep each review to two lines so the
 * block stays scannable on a phone.
 */
export const demoReviews = [
  {
    name: "Ahmed Sheikh",
    area: "DHA Phase 5",
    stars: 5,
    image: "/images/reviewer-1.webp",
    alt: "Portrait of a man in a white shalwar kameez in his living room, used as a review avatar on this demonstration site",
    text: "They found the leak before topping up the gas, and wrote the pressures down on the job card. First time someone showed me the numbers instead of the bill.",
  },
  {
    name: "Sadia Khan",
    area: "Gulshan-e-Iqbal Block 6",
    stars: 5,
    image: "/images/reviewer-2.webp",
    alt: "Portrait of a woman in a light blue dupatta in a bright kitchen, used as a review avatar on this demonstration site",
    text: "Jet cleaning before the season, dust sheets on the floor, and a photo of both coils before and after on WhatsApp. The drain smell has stayed gone.",
  },
  {
    name: "Bilal Aslam",
    area: "Clifton Block 2",
    stars: 4,
    image: "/images/reviewer-3.webp",
    alt: "Portrait of a shopkeeper in a waistcoat inside his electronics shop, used as a review avatar on this demonstration site",
    text: "Our shop cassette died on a Saturday. They came after closing, found a burnt contactor, and the fans were turning again before morning.",
  },
] as const;

/** Job-site photography for the work gallery. */
export const projects = [
  { image: "/images/work-van.jpg", alt: "Freeze Point service pickup staged for a Karachi call-out", caption: "Clifton · morning call-out" },
  { image: "/images/work-jet.jpg", alt: "Outdoor condenser jet-cleaned on a rooftop in Gulshan", caption: "Gulshan-e-Iqbal · two coils washed" },
  { image: "/images/work-inverter.jpg", alt: "Inverter power board benched and tested with a multimeter", caption: "North Nazimabad · board repaired" },
  { image: "/images/work-ducted.jpg", alt: "Ducted ceiling units and galvanised ductwork being serviced", caption: "Shahrah-e-Faisal · ducted filters" },
  { image: "/images/work-install.jpg", alt: "A new split air conditioner indoor unit being levelled and mounted", caption: "DHA Phase 5 · new 1.5-ton unit" },
  { image: "/images/work-hero.jpg", alt: "Technician servicing a rooftop condenser across a Karachi skyline", caption: "Bahadurabad · pre-season service" },
] as const;
