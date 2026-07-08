import { Navbar } from "./components/navbar";
import { Hero } from "./components/hero";
import { WhyGeneralAI } from "./components/why-general-ai";
import { StickyStack } from "./components/sticky-stack";
import { LiveDemo } from "./components/live-demo";
import { ComparisonTable } from "./components/comparison-table";
import { PricingCTA } from "./components/pricing-cta";
import { Footer } from "./components/footer";

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex flex-col">
        <Hero />
        <WhyGeneralAI />
        <StickyStack />
        <LiveDemo />
        <ComparisonTable />
        <PricingCTA />
      </main>
      <Footer />
    </>
  );
}
