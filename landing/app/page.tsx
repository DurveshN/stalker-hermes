import { Nav } from "@/components/site/nav";
import { Hero } from "@/components/site/hero";
import { HowItWorks } from "@/components/site/how-it-works";
import { Agency } from "@/components/site/agency";
import { SampleBrief } from "@/components/site/sample-brief";
import { Pricing } from "@/components/site/pricing";
import { Faq } from "@/components/site/faq";
import { Footer } from "@/components/site/footer";

export default function Home() {
  return (
    <>
      <Nav />
      <main className="flex-1">
        <Hero />
        <HowItWorks />
        <Agency />
        <SampleBrief />
        <Pricing />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
