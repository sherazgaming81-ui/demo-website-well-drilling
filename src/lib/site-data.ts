/**
 * Aquifer Reach LLC — business content.
 * Service names, descriptions, addresses, phone and hours are taken from the
 * company's published material. Proof points and stats are the figures they
 * publish; nothing here is invented.
 */
export const business = {
  name: "Aquifer Reach LLC",
  shortName: "Aquifer Reach",
  tagline: "A Well Drilling Company",
  headline: "Your water starts right here.",
  phoneDisplay: "(904) 477-9809",
  phoneHref: "tel:+19044779809",
  region: "Northeast Florida",
  mailingAddress: "14404 Bartram Creek Blvd, St Johns, FL 32259",
  mailingNote: "Mailing address only",
  yardAddress: "646 E 21st St, Jacksonville, FL 32206",
  yardNote: "Yard · by appointment only",
  hours: [
    { days: "Monday – Friday", time: "8 am – 6 pm" },
    { days: "Saturday", time: "8 am – 12 pm" },
    { days: "Sunday", time: "Closed" },
  ],
  established: 2017,
} as const;

export const stats = [
  { value: "8+", label: "Years experience" },
  { value: "1,000s", label: "Wells drilled" },
  { value: "100%", label: "Licensed & insured" },
] as const;

export const proofPoints = [
  "Licensed & certified Florida well contractors",
  "Family-owned and locally operated since 2017",
  "Free on-site estimates with no obligations",
  "Modern equipment for efficient, clean drilling",
  "Permitting handled — we advise on city approvals during your free estimate",
  "Satisfaction guaranteed on every project",
] as const;

export const services = [
  {
    id: "rock-wells",
    number: "01",
    category: "FOR RELIABLE WATER",
    title: "Rock wells",
    description: "Professional rock well drilling for reliable, long-lasting water sources in Northeast Florida.",
    image: "/images/rock-wells.jpg",
    alt: "Active well drilling site with mud tanks and drill rig",
    link: "Drill a rock well",
    detail: "Rock wells reach water held in hard rock formations and, done right, they are among the longest-lived private water supplies you can have. We start by walking your property, talking through what the local formations typically yield, and explaining the casing and depth we expect before any rig moves in.",
    benefits: ["Property walk-through before we quote", "Casing and screen sized to your formation", "Yield discussed with you before completion", "Site left clean when the rig moves out"],
  },
  {
    id: "screen-wells",
    number: "02",
    category: "FOR SANDY FORMATIONS",
    title: "Screen wells",
    description: "Screen well installation designed for optimal water flow from sandy aquifer formations.",
    image: "/images/screen-wells.jpg",
    alt: "Well pipe installation and trenching at a Jacksonville job site",
    link: "Install a screen well",
    detail: "In the sandy aquifers common across our part of Florida, a screened well is often the right answer — good flow, faster to drill, easier to maintain. The screen has to match the sand it sits in, or you pump sand instead of water. That sizing conversation happens with you, not after the fact.",
    benefits: ["Screen selection matched to formation", "Straightforward, faster drilling method", "Built for flow and easy servicing", "Explained in plain terms before we start"],
  },
  {
    id: "artesian-wells",
    number: "03",
    category: "FOR NATURAL PRESSURE",
    title: "Artesian wells",
    description: "Expert artesian well drilling tapping into Florida's natural pressurized aquifers.",
    image: "/images/artesian-wells.jpg",
    alt: "Drill rig and equipment at a jobsite with sun flare",
    link: "Assess artesian potential",
    detail: "Florida sits on pressurized aquifers, and on some properties that pressure means water that rises on its own. It is not something to guess about — depth, casing and control all matter. We tell you honestly whether your parcel is a realistic candidate before you commit to a project.",
    benefits: ["Honest read on your chances first", "Pressure and depth planned, not assumed", "Casing and flow control handled properly", "Local aquifer experience on your side"],
  },
  {
    id: "salt-pepper-wells",
    number: "04",
    category: "FOR TOUGH GROUND",
    title: "Salt & pepper wells",
    description: "Specialized salt and pepper well drilling for unique geological conditions.",
    image: "/images/salt-pepper-wells.jpg",
    alt: "Drilling equipment and trucks at a job site during dusk",
    link: "Discuss your ground",
    detail: "Some parcels give you problems in layers — fresh water, salt water and everything in between, stacked in the same hole. This is where method and patience matter more than speed. We talk through what the ground is likely to do and how we plan to handle it.",
    benefits: ["Built for difficult, layered formations", "Water quality discussed up front", "Method chosen for your ground, not a template", "Careful logging as the hole goes down"],
  },
  {
    id: "pump-installation",
    number: "05",
    category: "FOR SYSTEM PERFORMANCE",
    title: "Pump installation",
    description: "Complete water well pump installation, replacement, and repair services.",
    image: "/images/pump-installation.jpg",
    alt: "Pressure tank installations at a residential site",
    link: "Fix or replace a pump",
    detail: "Low pressure, a pump that runs and stops all night, or a tank that is losing air — these are usually fixable, and not always by replacing everything. We size the pump to the well and the house, so you get steady pressure without burning through equipment.",
    benefits: ["Pump sized to yield and household demand", "Pressure tank and controls checked together", "Replacement and repair, not upsell", "Clear explanation of what actually failed"],
  },
  {
    id: "well-abandonment",
    number: "06",
    category: "FOR SAFE CLOSURE",
    title: "Well abandonment",
    description: "Proper abandonment and sealing of unused wells per Florida regulations.",
    image: "/images/well-abandonment.jpg",
    alt: "Completed well hookup with filtration at a Northeast Florida property",
    link: "Close a well properly",
    detail: "An unused well that is not sealed correctly is a liability — it can let surface water contaminate the aquifer, and it can come up when you sell the property. Florida has rules for how abandonment is done. We handle the work and the paperwork side so it is closed the right way.",
    benefits: ["Sealed to Florida requirements", "Protects groundwater and your title", "Paperwork and permitting guidance", "Site restored after the seal"],
  },
] as const;

export const bookingServices = [
  { value: "rock-wells", label: "New rock well" },
  { value: "screen-wells", label: "New screen well" },
  { value: "artesian-wells", label: "Artesian well" },
  { value: "salt-pepper-wells", label: "Salt & pepper well" },
  { value: "pump-installation", label: "Pump installation or repair" },
  { value: "well-abandonment", label: "Well abandonment" },
  { value: "not-sure", label: "I'm not sure yet" },
] as const;

/** The three steps a customer actually goes through with us. */
export const steps = [
  { icon: "message", title: "Tell us about the property.", description: "Call, or send the short estimate request. Address, what you need, and any trouble you are already having — that is enough to start." },
  { icon: "ruler", title: "We come out and look.", description: "A free on-site visit. We walk the ground, talk through formations and depth, and advise on the city approvals your project will need." },
  { icon: "file-check", title: "You get a clear number.", description: "A written estimate with the method, the expected depth range and what is included. No obligation, and no work starts until you say so." },
] as const;

export const faqs = [
  { question: "What happens during the free estimate?", answer: "We come to the property and look at the ground, the access and what you need the water for. You get a plain explanation of the method that suits your formation, what depth to expect, which city approvals apply, and a written estimate to take your time over. There is no charge for the visit and no obligation to book." },
  { question: "Do you handle the permitting?", answer: "Yes. Permitting is handled by us, and our representative will advise you on any city or county approvals your project needs during the free estimate. Florida requires wells to be drilled by licensed contractors and abandoned properly, so this part is not optional — we just make sure it is done correctly." },
  { question: "How long does it take to drill a well?", answer: "Most residential wells are drilled in a few days once the rig is on site. The full timeline also depends on the formation, target depth, weather, pump installation and how quickly permits clear. We give you a realistic schedule with your estimate, not a hopeful one." },
  { question: "What does a new well cost?", answer: "It depends on depth, casing, the pump system and site conditions, so anyone quoting a flat number sight-unseen is guessing. The on-site visit is how we narrow it down — you get a written, itemized estimate for your property and can compare it properly." },
  { question: "My well is old or failing. Is it worth fixing?", answer: "Often, yes. A drop in pressure, a pump cycling all night or sand in the water usually has a specific cause. Send us what you are seeing and we will tell you honestly whether it is a pump, a tank, a screen, or the well itself — before recommending the expensive option." },
  { question: "Which areas do you cover?", answer: "We drill across Northeast Florida, serving Jacksonville and the surrounding communities. Tell us your ZIP code with your request and we will confirm coverage straight away." },
] as const;

/** Real job-site photography from the company's own projects. */
export const projects = [
  { image: "/images/work-1.jpg", alt: "Aquifer Reach truck at a commercial drilling site", caption: "Commercial site · Jacksonville" },
  { image: "/images/work-2.jpg", alt: "Aquifer Reach drilling truck parked at a Jacksonville job site", caption: "Trucks staged · Jacksonville" },
  { image: "/images/work-3.jpg", alt: "Well pipe installation and trenching at a Northeast Florida property", caption: "Casing in · screen well" },
  { image: "/images/work-4.jpg", alt: "Pressure tank installations at a residential site", caption: "Pump and tank swap" },
  { image: "/images/work-5.jpg", alt: "Active well drilling site with mud tanks and drill rig", caption: "Mud tanks running" },
  { image: "/images/work-6.jpg", alt: "Drill rig and equipment at a jobsite with sun flare", caption: "Finishing on the last light" },
] as const;
