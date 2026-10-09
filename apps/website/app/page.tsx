import { CloseSection } from "@/components/CloseSection";
import { EvidenceSection } from "@/components/EvidenceSection";
import { Hero } from "@/components/Hero";
import { HowSection } from "@/components/HowSection";
import { MeasuresSection } from "@/components/MeasuresSection";
import { Nav } from "@/components/Nav";
import { NumbersSection } from "@/components/NumbersSection";
import { RunSection } from "@/components/RunSection";
import { SafetySection } from "@/components/SafetySection";

export default function Page() {
  return (
    <>
      <Nav />
      <main id="main">
        <Hero />
        <RunSection />
        <HowSection />
        <NumbersSection />
        <MeasuresSection />
        <EvidenceSection />
        <SafetySection />
        <CloseSection />
      </main>
    </>
  );
}
