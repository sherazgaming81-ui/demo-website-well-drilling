/**
 * Freeze Point AC Care — the single source of truth for every word on the site.
 *
 * This is a demonstration brand built to show a client what their own site could
 * look like: the phone numbers, address and figures here are illustrative, not a
 * real company's. Change this one file and the page, the estimate form, the chat
 * assistant's brief and its offline answers all follow together — that is deliberate,
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

/** Job-site photography for the work gallery. */
export const projects = [
  { image: "/images/work-van.jpg", alt: "Freeze Point service pickup staged for a Karachi call-out", caption: "Clifton · morning call-out" },
  { image: "/images/work-jet.jpg", alt: "Outdoor condenser jet-cleaned on a rooftop in Gulshan", caption: "Gulshan-e-Iqbal · two coils washed" },
  { image: "/images/work-inverter.jpg", alt: "Inverter power board benched and tested with a multimeter", caption: "North Nazimabad · board repaired" },
  { image: "/images/work-ducted.jpg", alt: "Ducted ceiling units and galvanised ductwork being serviced", caption: "Shahrah-e-Faisal · ducted filters" },
  { image: "/images/work-install.jpg", alt: "A new split air conditioner indoor unit being levelled and mounted", caption: "DHA Phase 5 · new 1.5-ton unit" },
  { image: "/images/work-hero.jpg", alt: "Technician servicing a rooftop condenser across a Karachi skyline", caption: "Bahadurabad · pre-season service" },
] as const;
