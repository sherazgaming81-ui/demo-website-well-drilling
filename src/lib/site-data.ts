export const services = [
  {
    id: "residential",
    number: "01",
    category: "FOR YOUR HOME",
    title: "Residential wells",
    description: "Your own source of clean, dependable water. Built for your home and everyone in it.",
    image: "/images/residential.jpg",
    alt: "A welcoming white farmhouse surrounded by a green lawn and mature trees",
    link: "Water for your home",
    detail: "A great home starts with a dependable water supply. We help you understand your property, explore your options, and plan a well system around your household—not a one-size-fits-all solution.",
    benefits: ["Site assessment and local geology review", "New well drilling and casing installation", "Pump sizing and pressure-system planning", "Yield testing and water-quality testing guidance"],
  },
  {
    id: "agricultural",
    number: "02",
    category: "FOR YOUR LIVELIHOOD",
    title: "Agricultural & commercial",
    description: "Water that works as hard as you do. Scalable well solutions for farms and businesses.",
    image: "/images/agricultural.jpg",
    alt: "Expansive green American agricultural fields viewed from above",
    link: "Water for your business",
    detail: "From keeping livestock watered to supporting a growing operation, your water needs are anything but ordinary. We work through capacity, seasonal demand, and site conditions to help you plan with confidence.",
    benefits: ["Agricultural and livestock water supplies", "Irrigation and high-capacity well planning", "Commercial site and demand assessments", "Flow testing and long-term system planning"],
  },
  {
    id: "well-care",
    number: "03",
    category: "FOR THE LONG RUN",
    title: "Well care & pump systems",
    description: "Keep the good water flowing. Expert troubleshooting, maintenance, and upgrades.",
    image: "/images/well-care.jpg",
    alt: "A professionally installed water pressure gauge and steel pipe system",
    link: "Care for your well",
    detail: "Low pressure, an aging pump, or a well that just isn't keeping up? Start with a clear conversation. Our team can help identify the right next step, explain repair options, and plan for reliable performance.",
    benefits: ["Well-performance and pressure assessments", "Pump and pressure-tank replacement", "Preventive maintenance and system upgrades", "Existing-well troubleshooting and rehabilitation"],
  },
] as const;

export const bookingServices = [
  { value: "residential", label: "Residential well" },
  { value: "agricultural", label: "Agricultural well" },
  { value: "commercial", label: "Commercial well" },
  { value: "well-care", label: "Well care & pump systems" },
  { value: "not-sure", label: "I'm not sure yet" },
] as const;

export const testimonials = [
  {
    quote: "From our first conversation to the first drop of water, the whole process felt easy. They showed up when they said they would, explained everything, and treated our property like their own.",
    name: "Mark & Sarah T.",
    type: "Residential well owners",
    location: "North Carolina",
    initials: "MT",
    image: "/images/homeowner-1.jpg",
    highlight: "Good people. Great water. No surprises.",
  },
  {
    quote: "Our farm depends on a steady water supply. The team took the time to understand what we needed, gave us a clear plan, and kept us in the loop every step of the way.",
    name: "James R.",
    type: "Family farm owner",
    location: "Virginia",
    initials: "JR",
    image: "/images/homeowner-2.jpg",
    highlight: "A team that understands what’s at stake.",
  },
  {
    quote: "We had questions about our old well and never felt pressured into a big project. Just honest advice, practical options, and a team that genuinely wanted to help.",
    name: "Michelle D.",
    type: "Well care customer",
    location: "Tennessee",
    initials: "MD",
    image: "/images/homeowner-3.jpg",
    highlight: "Finally, answers we could feel good about.",
  },
] as const;

export const faqs = [
  { question: "What happens during a free demo?", answer: "We start with a friendly, no-obligation conversation about your property and water needs. A well specialist walks you through our equipment, drilling process, and possible solutions, then outlines the next steps. Share your ZIP code when booking so we can discuss remote or on-site options and confirm coverage." },
  { question: "How long does it take to drill a well?", answer: "Many residential wells can be drilled in a few days once the crew is on site. Your total timeline also depends on geology, depth, permits, weather, and pump installation. We'll explain a realistic, property-specific timeline before any work begins." },
  { question: "What does a new well cost?", answer: "Every property is different. Depth, ground conditions, local requirements, and the pump system all affect the cost. Your free demo helps us understand the project so we can explain the main cost factors and the steps toward a written estimate. No commitment is required." },
  { question: "Can you help with my existing well?", answer: "Absolutely. Choose ‘Well care & pump systems’ when booking. We can discuss low pressure, an aging pump, changes in performance, maintenance, or water-quality concerns and help you determine whether an on-site assessment is the right next step." },
  { question: "Do you work in my area?", answer: "Enter your five-digit US ZIP code with your demo request. We'll confirm local crew coverage, applicable licensing, and appointment options before scheduling. Coverage and on-site availability vary by location; a request is not a confirmed appointment." },
] as const;
