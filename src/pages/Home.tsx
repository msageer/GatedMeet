import { motion } from 'motion/react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Calendar, ShieldCheck, Zap, Globe, CreditCard, Sparkles } from 'lucide-react';

export default function Home() {
  return (
    <div className="space-y-24 pb-24">
      {/* Hero Section */}
      <section className="relative pt-12 text-center space-y-8 max-w-4xl mx-auto">
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-50 border border-orange-100 text-orange-600 text-sm font-medium mb-4"
        >
          <Sparkles className="w-3 h-3" />
          The Future of Tech Education
        </motion.div>
        
        <motion.h1 
          className="text-6xl md:text-8xl font-display font-extrabold tracking-tight leading-[0.9] text-slate-900"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          MONETIZE YOUR <span className="text-primary italic">EXPERTISE.</span>
        </motion.h1>
        
        <motion.p 
          className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          The zero-risk platform for tech educators. Share your link, get paid instantly in Fiat or Crypto, 
          and let us handle the scheduling.
        </motion.p>
        
        <motion.div 
          className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Link to="/auth" className={buttonVariants({ size: "lg", className: "h-14 px-8 text-lg font-bold shadow-xl shadow-orange-200" })}>Start Teaching Now</Link>
          <Link to="/auth" className={buttonVariants({ size: "lg", variant: "outline", className: "h-14 px-8 text-lg font-bold border-2" })}>Join as Creator</Link>
        </motion.div>
      </section>

      {/* Features Grid */}
      <section className="grid md:grid-cols-3 gap-8 px-4">
        {[
          {
            icon: Zap,
            title: "Automated Meetings",
            desc: "Google Meet link generated automatically only after successful payment."
          },
          {
            icon: CreditCard,
            title: "Multi-Currency",
            desc: "Accept traditional Fiat via Paystack or stablecoins on the TON network."
          },
          {
            icon: ShieldCheck,
            title: "Zero Risk",
            desc: "Free for creators. We only take a small commission when you earn."
          }
        ].map((feature, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="p-8 rounded-3xl bg-white border border-slate-100 shadow-sm hover:shadow-xl transition-all group"
          >
            <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center mb-6 group-hover:bg-primary/10 transition-colors">
              <feature.icon className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-2xl font-bold mb-3">{feature.title}</h3>
            <p className="text-slate-500 leading-relaxed">{feature.desc}</p>
          </motion.div>
        ))}
      </section>

      {/* Pricing / Commission Banner */}
      <motion.section 
        className="bg-slate-900 rounded-[3rem] p-12 text-white relative overflow-hidden"
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
      >
        <div className="relative z-10 grid md:grid-cols-2 items-center gap-12">
          <div className="space-y-6">
            <h2 className="text-4xl md:text-5xl font-display font-bold leading-tight">
              We only win when <span className="text-primary italic">you win.</span>
            </h2>
            <p className="text-slate-400 text-lg">
              No monthly fees. No hidden costs. We take a flat 5-10% commission per booking to cover platform costs, payment processing, and hosting.
            </p>
          </div>
          <div className="flex justify-center md:justify-end">
            <div className="text-center p-8 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-xl">
              <div className="text-5xl font-extrabold text-primary mb-2">5-10%</div>
              <div className="text-slate-400 font-medium">Platform Fee</div>
            </div>
          </div>
        </div>
        {/* Background blobs */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] -translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-500/10 blur-[100px] translate-y-1/2" />
      </motion.section>
    </div>
  );
}
