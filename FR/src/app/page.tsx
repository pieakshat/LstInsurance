import { Nav }        from "./_landing/nav";
import { Hero }       from "./_landing/hero";
import { StatsBar }   from "./_landing/stats-bar";
import { HowItWorks } from "./_landing/how-it-works";
import { Features }   from "./_landing/features";
import { ForLPs }     from "./_landing/for-lps";
import { Footer }     from "./_landing/footer";

export default function Home() {
  return (
    <div className="bg-[#07090f] text-white overflow-x-hidden">
      <Nav />
      <Hero />
      <StatsBar />
      <HowItWorks />
      <Features />
      <ForLPs />
      <Footer />
    </div>
  );
}
