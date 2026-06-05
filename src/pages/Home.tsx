import { motion } from 'motion/react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  Zap, 
  CreditCard, 
  Sparkles, 
  ArrowRight,
  TrendingUp,
  Clock,
  Rocket,
  Globe
} from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col gap-32 pb-32 overflow-hidden">
      {/* Hero Section - Editorial Style */}
      <section className="relative pt-20 px-6 max-w-7xl mx-auto w-full">
        <div className="grid lg:grid-cols-[1fr_400px] gap-12 items-start">
          <div className="space-y-10">
            <motion.div
               initial={{ opacity: 0, x: -20 }}
               animate={{ opacity: 1, x: 0 }}
               className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-bold tracking-tight uppercase"
            >
              <Sparkles className="w-3.5 h-3.5" />
              The Next Evolution for Creators
            </motion.div>
            
            <motion.h1 
              className="text-[clamp(3.5rem,10vw,8rem)] font-display font-extrabold tracking-tighter leading-[0.85] text-slate-900 uppercase"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.8, ease: "circOut" }}
            >
              Monetize <br />
              Your <span className="text-primary italic">Audience.</span>
            </motion.h1>
            
            <motion.p 
              className="text-xl md:text-2xl text-slate-500 max-w-xl leading-relaxed font-light"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.8 }}
            >
              Get a stunning personal landing page for your brand. Share your portfolio,
              accept bookings directly, and jump into calls automatically. Zero friction.
            </motion.p>
            
            <motion.div 
              className="flex flex-wrap items-center gap-6 pt-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Link to="/auth" className={buttonVariants({ size: "lg", className: "h-16 px-10 text-lg font-bold rounded-2xl shadow-2xl shadow-primary/20 group" })}>
                Build Your Page Free
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link to="/auth" className="text-lg font-bold hover:text-primary transition-colors flex items-center gap-2 group">
                Join as Creator
                <div className="w-8 h-[1px] bg-slate-300 group-hover:w-12 transition-all group-hover:bg-primary" />
              </Link>
            </motion.div>
          </div>

          <motion.div 
            className="hidden lg:block relative"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 1 }}
          >
            <div className="aspect-[4/5] rounded-[3rem] bg-slate-100 border border-slate-200 shadow-inner overflow-hidden relative group">
               <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
               <div className="absolute inset-0 p-8 flex flex-col justify-between">
                  <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                    <Rocket className="w-8 h-8 text-primary" />
                  </div>
                  <div className="space-y-4">
                    <div className="h-4 w-3/4 bg-slate-200 rounded-full" />
                    <div className="h-4 w-1/2 bg-slate-200 rounded-full" />
                    <div className="pt-4 flex gap-2">
                       <div className="w-12 h-12 rounded-full bg-white shadow-sm" />
                       <div className="w-12 h-12 rounded-full bg-white shadow-sm" />
                       <div className="w-12 h-12 rounded-full bg-white shadow-sm" />
                    </div>
                  </div>
               </div>
               {/* Technical Accents */}
               <div className="absolute top-1/2 left-0 w-full h-[1px] bg-slate-200/50 -rotate-12" />
               <div className="absolute top-0 left-1/2 w-[1px] h-full bg-slate-200/50 -rotate-12" />
            </div>
            
            {/* Floating Stats */}
            <div className="absolute -right-12 top-24 bg-white p-6 rounded-3xl shadow-2xl border border-slate-100 animate-bounce-slow">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wider">Earnings</div>
                    <div className="text-xl font-bold">$1,250.00</div>
                  </div>
               </div>
            </div>
          </motion.div>
        </div>

        {/* Brand Scroller / Marquee Effect Mockup */}
        <div className="pt-24 flex items-center gap-12 opacity-30 grayscale saturate-0 pointer-events-none overflow-hidden whitespace-nowrap">
          <Link className="text-2xl font-bold flex items-center gap-2"><Globe className="w-6 h-6" /> GLOBAL REACH</Link>
          <div className="w-2 h-2 rounded-full bg-slate-400" />
          <Link className="text-2xl font-bold flex items-center gap-2"><Zap className="w-6 h-6" /> PLATFORM MEETINGS</Link>
          <div className="w-2 h-2 rounded-full bg-slate-400" />
          <Link className="text-2xl font-bold flex items-center gap-2"><ShieldCheck className="w-6 h-6" /> VERIFIED CREATORS</Link>
          <div className="w-2 h-2 rounded-full bg-slate-400" />
          <Link className="text-2xl font-bold flex items-center gap-2"><Clock className="w-6 h-6" /> AUTOMATED SYNC</Link>
        </div>
      </section>

      {/* Benefits - Modern Split Card Style */}
      <section className="px-6 max-w-7xl mx-auto w-full">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col md:flex-row justify-between items-end gap-6 mb-12">
            <h2 className="text-5xl font-display font-bold tracking-tight max-w-md">Everything you need to <span className="italic text-primary">scale.</span></h2>
            <p className="text-slate-500 max-w-sm text-lg">Focus on your brand, we maintain the rails for your business growth.</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Zap,
                title: "Personal Landing Page",
                desc: "A fully dedicated page for your portfolio, bio, and automated session bookings.",
                color: "bg-blue-500"
              },
              {
                icon: CreditCard,
                title: "Internal & Google Meet",
                desc: "Host meetings directly on our platform via built-in audio/video, or sync with Google Meet.",
                color: "bg-orange-500"
              },
              {
                icon: ShieldCheck,
                title: "Creator First",
                desc: "No monthly subscription. We only take a small slice once you are actually making money.",
                color: "bg-green-500"
              }
            ].map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="group p-10 rounded-[2.5rem] bg-white border border-slate-100 hover:border-primary/20 hover:shadow-2xl hover:shadow-primary/5 transition-all duration-500"
              >
                <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center mb-8 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500">
                  <feature.icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-4 tracking-tight">{feature.title}</h3>
                <p className="text-slate-500 text-lg leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing / Commission Banner - High Contrast Visibility Fix */}
      <div className="px-6 max-w-7xl mx-auto w-full">
        <motion.section 
          className="bg-slate-950 rounded-[3rem] p-12 md:p-24 text-white relative overflow-hidden"
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
        >
          <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-16">
            <div className="max-w-xl space-y-8">
              <h2 className="text-5xl md:text-7xl font-display font-bold leading-[0.9] tracking-tighter">
                We only win <br />
                when <span className="text-primary italic drop-shadow-[0_0_15px_rgba(var(--primary),0.3)]">you win.</span>
              </h2>
              <p className="text-slate-400 text-xl md:text-2xl font-light leading-relaxed">
                Zero setup fees. Zero monthly costs. We simply take a flat 5-10% to power your global business.
              </p>
              <div className="pt-4">
                <Link to="/auth" className="inline-flex items-center gap-2 group text-primary font-bold text-xl uppercase tracking-widest">
                  Connect Wallet to Start
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-2 transition-transform" />
                </Link>
              </div>
            </div>
            
            <div className="relative">
              <div className="w-64 h-64 md:w-80 md:h-80 rounded-full border-[1.5px] border-white/10 flex items-center justify-center relative">
                 <div className="absolute inset-0 rounded-full border-[1.5px] border-primary/20 animate-ping duration-[3000ms]" />
                 <div className="text-center">
                    <div className="text-7xl md:text-8xl font-black text-primary drop-shadow-[0_0_25px_rgba(var(--primary),0.4)]">5-10%</div>
                    <div className="text-slate-400 font-bold tracking-[0.3em] uppercase text-sm mt-2">Platform Fee</div>
                 </div>
              </div>
            </div>
          </div>
          
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-blue-500/10 rounded-full blur-[120px] translate-y-1/2 -translate-x-1/4" />
          
          {/* Grid Pattern */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:40px_40px]" />
        </motion.section>
      </div>
    </div>
  );
}

