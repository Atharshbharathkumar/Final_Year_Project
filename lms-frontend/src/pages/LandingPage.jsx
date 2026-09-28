import React from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, Brain, Target, ShieldCheck, Activity, Users, MonitorPlay, 
  HelpCircle, BarChart3, Clock, Sparkles, ChevronRight, Lock
} from 'lucide-react';

const FadeIn = ({ children, delay = 0, direction = "up" }) => {
  const yOffset = direction === "up" ? 40 : direction === "down" ? -40 : 0;
  const xOffset = direction === "left" ? 40 : direction === "right" ? -40 : 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: yOffset, x: xOffset }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
};

const LandingPage = () => {
  const { scrollYProgress } = useScroll();
  const yHero = useTransform(scrollYProgress, [0, 1], [0, 300]);

  return (
    <div className="min-h-screen bg-dark-bg selection:bg-brand-500/30 selection:text-white">
      {/* Navigation */}
      <nav className="fixed w-full z-50 bg-dark-bg/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center shadow-lg shadow-brand-500/25">
              <span className="text-white font-bold text-lg">E</span>
            </div>
            <span className="text-xl font-bold text-white tracking-tight">EduVerse AI</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
             <a href="#intelligence" className="hover:text-white transition-colors">Intelligence Engine</a>
             <a href="#interventions" className="hover:text-white transition-colors">Interventions</a>
             <a href="#digital-twin" className="hover:text-white transition-colors">Digital Twin</a>
             <Link to="/responsible-ai" className="hover:text-amber-400 transition-colors flex items-center gap-1"><ShieldCheck size={14}/> Trust Center</Link>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-slate-300 hover:text-white transition-colors hidden sm:block">Sign In</Link>
            <Link to="/login" className="gradient-btn px-6 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center gap-2 group relative z-10 hover:shadow-lg hover:shadow-brand-500/25 transition-all">
              Explore Demo <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03] pointer-events-none" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-brand-500/20 rounded-full blur-[150px] pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <motion.div style={{ y: yHero }} className="text-center max-w-4xl mx-auto">
            <motion.div 
               initial={{ opacity: 0, scale: 0.9 }} 
               animate={{ opacity: 1, scale: 1 }} 
               transition={{ duration: 0.8, ease: "easeOut" }}
               className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-violet-500/30 bg-violet-500/10 mb-8"
            >
              <Sparkles size={16} className="text-violet-400" />
              <span className="text-xs font-semibold text-violet-300 uppercase tracking-wider">The Adaptive Multimodal Platform</span>
            </motion.div>
            
            <h1 className="text-6xl md:text-7xl font-bold text-white tracking-tight mb-8 leading-[1.1]">
              Smarter Learning. <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 via-violet-400 to-emerald-400">Connected Classrooms.</span><br/>
              Adaptive Intelligence.
            </h1>
            
            <p className="text-lg text-slate-400 mb-12 max-w-3xl mx-auto leading-relaxed">
              EduVerse AI unifies learning management, virtual classrooms, academic analytics, and adaptive learning intelligence into one responsible educational ecosystem.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/login" className="w-full sm:w-auto gradient-btn px-8 py-4 rounded-xl text-base font-semibold text-white flex items-center justify-center gap-2 group hover:shadow-xl hover:shadow-brand-500/20 transition-all">
                Access Platform <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <a href="#intelligence" className="w-full sm:w-auto px-8 py-4 rounded-xl text-base font-semibold text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-center">
                Explore AI Research
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* The Intelligence Loop */}
      <section id="intelligence" className="py-24 relative overflow-hidden bg-dark-card border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
           <FadeIn>
              <div className="text-center mb-20 max-w-3xl mx-auto">
                 <h2 className="text-sm font-semibold text-brand-400 uppercase tracking-widest mb-3">Core Innovation</h2>
                 <h3 className="text-4xl font-bold text-white mb-6">The Adaptive Learning Loop</h3>
                 <p className="text-slate-400 leading-relaxed text-lg">
                    Traditional LMS platforms stop at data collection. EduVerse AI observes, understands, recommends, and evaluates—closing the loop on student engagement.
                 </p>
              </div>
           </FadeIn>

           <div className="grid md:grid-cols-5 gap-4 lg:gap-8 items-start relative max-w-5xl mx-auto">
              <div className="absolute top-12 left-10 right-10 h-0.5 bg-gradient-to-r from-brand-500 via-amber-500 to-emerald-500 opacity-20 hidden md:block" />
              
              {[
                 { title: 'Detect', icon: Activity, desc: 'Identify state transitions via multimodal signals.', color: 'text-brand-400', bg: 'bg-brand-500' },
                 { title: 'Explain', icon: Target, desc: 'Generate plain-text context behind anomalies.', color: 'text-violet-400', bg: 'bg-violet-500' },
                 { title: 'Intervene', icon: Brain, desc: 'Recommend data-driven AI learning interventions.', color: 'text-amber-400', bg: 'bg-amber-500' },
                 { title: 'Measure', icon: BarChart3, desc: 'Track performance directly following interventions.', color: 'text-cyan-400', bg: 'bg-cyan-500' },
                 { title: 'Learn', icon: Sparkles, desc: 'Improve the Student Digital Twin profile iteratively.', color: 'text-emerald-400', bg: 'bg-emerald-500' },
              ].map((step, i) => (
                 <FadeIn key={i} delay={i * 0.15}>
                    <div className="relative flex flex-col items-center text-center group">
                       <div className={`w-24 h-24 rounded-2xl bg-dark-bg border border-dark-border flex items-center justify-center mb-6 relative z-10 transition-transform duration-500 group-hover:-translate-y-2 group-hover:border-${step.color.split('-')[1]}/30`}>
                          <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-2xl ${step.bg}`} />
                          <step.icon size={36} className={`${step.color} transition-transform duration-500 group-hover:scale-110`} />
                       </div>
                       <h4 className="text-lg font-bold text-white mb-2">{step.title}</h4>
                       <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
                    </div>
                 </FadeIn>
              ))}
           </div>
        </div>
      </section>

      {/* Feature Showcases */}
      <section id="interventions" className="py-24">
        <div className="max-w-7xl mx-auto px-6 space-y-32">
           
           {/* ALSE */}
           <div className="grid lg:grid-cols-2 gap-16 items-center">
              <FadeIn direction="right">
                 <h3 className="text-3xl font-bold text-white mb-6">Adaptive Learning State Engine (ALSE)</h3>
                 <p className="text-slate-400 text-lg leading-relaxed mb-6">
                    Move beyond binary "engaged/distracted" metrics. The ALSE fuses academic performance, classroom behavior, and localized computer vision to categorize complex cognitive states like <strong>Deep Learning</strong>, <strong>Struggling</strong>, and <strong>Collaborative</strong>.
                 </p>
                 <ul className="space-y-4 mb-8">
                    {['Detects shifts in learning states over time.', 'Explains exactly why a score changed.', 'Differentiates between productive shifting and distraction.'].map((li, i) => (
                       <li key={i} className="flex items-start gap-3 text-slate-300">
                          <CheckCircle2 size={20} className="text-brand-400 shrink-0" /> <span>{li}</span>
                       </li>
                    ))}
                 </ul>
                 <Link to="/login" className="text-brand-400 font-semibold hover:text-brand-300 flex items-center gap-2">View ALSE Dashboard <ChevronRight size={16}/></Link>
              </FadeIn>
              <FadeIn direction="left" delay={0.2} className="relative">
                 <div className="absolute inset-0 bg-gradient-to-br from-brand-500/20 to-violet-500/20 blur-3xl transform rotate-12 scale-110 -z-10" />
                 <img src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=800" alt="Dashboard visualization" className="rounded-2xl border border-white/10 shadow-2xl opacity-70 mix-blend-screen" />
              </FadeIn>
           </div>
           
           {/* Simulator */}
           <div className="grid lg:grid-cols-2 gap-16 items-center">
              <FadeIn direction="right" className="order-2 lg:order-1 relative">
                 <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 blur-3xl transform -rotate-12 scale-110 -z-10" />
                 <img src="https://images.unsplash.com/photo-1543286386-2e659306cd6c?auto=format&fit=crop&q=80&w=800" alt="Simulation UI" className="rounded-2xl border border-white/10 shadow-2xl opacity-70 mix-blend-screen grayscale hue-rotate-180" />
              </FadeIn>
              <FadeIn direction="left" delay={0.2} className="order-1 lg:order-2">
                 <h3 className="text-3xl font-bold text-white mb-6">What-If Learning Simulator</h3>
                 <p className="text-slate-400 text-lg leading-relaxed mb-6">
                    Before acting, simulate interventions. Query the engine: <em>"What might happen if I provide a revision video to struggling students?"</em> See predicted shifts in cohort engagement and assessment scores instantly.
                 </p>
                 <ul className="space-y-4 mb-8">
                    {['Generates statistical academic forecasts.', 'Explores multiple pedagogical scenarios side-by-side.', 'Empowers educators with data-driven confidence.'].map((li, i) => (
                       <li key={i} className="flex items-start gap-3 text-slate-300">
                          <CheckCircle2 size={20} className="text-cyan-400 shrink-0" /> <span>{li}</span>
                       </li>
                    ))}
                 </ul>
                 <Link to="/login" className="text-cyan-400 font-semibold hover:text-cyan-300 flex items-center gap-2">Try the Simulator <ChevronRight size={16}/></Link>
              </FadeIn>
           </div>
           
           {/* Responsible AI */}
           <div className="grid lg:grid-cols-2 gap-16 items-center">
              <FadeIn direction="right">
                 <h3 className="text-3xl font-bold text-white mb-6">Responsible AI & Privacy First</h3>
                 <p className="text-slate-400 text-lg leading-relaxed mb-6">
                    EduVerse AI assists educators with evidence, it does not replace human judgment. All camera and screen analysis is strictly consent-based, processed locally in the browser, and avoids stigmatizing profiling. 
                 </p>
                 <div className="p-6 rounded-2xl bg-dark-card border border-dark-border flex items-start gap-4 mb-8">
                    <Lock size={24} className="text-emerald-400 shrink-0 mt-1" />
                    <div>
                        <h4 className="text-white font-semibold mb-2">Zero Video Transmission</h4>
                        <p className="text-sm text-slate-400 leading-relaxed">Computer Vision inference executes completely on the client device. Video streams are never captured, transmitted, or saved to the cloud.</p>
                    </div>
                 </div>
                 <Link to="/login" className="text-emerald-400 font-semibold hover:text-emerald-300 flex items-center gap-2">View Trust Center <ChevronRight size={16}/></Link>
              </FadeIn>
              <FadeIn direction="left" delay={0.2} className="relative">
                 <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 blur-3xl transform rotate-6 scale-110 -z-10" />
                 <img src="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=800" alt="Security visualization" className="rounded-2xl border border-white/10 shadow-2xl opacity-70 mix-blend-screen" />
              </FadeIn>
           </div>

        </div>
      </section>

      {/* CTA */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-dark-bg to-brand-900/20" />
        <div className="max-w-4xl mx-auto px-6 relative z-10 text-center">
           <FadeIn>
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-500 flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-brand-500/30">
                 <Sparkles size={32} className="text-white" />
              </div>
              <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Don't just monitor students.<br/>Understand how they learn.</h2>
              <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto">
                 Experience the future of evidence-based pedagogy and adaptive multimedia intelligence today.
              </p>
              <Link to="/login" className="gradient-btn px-10 py-5 rounded-2xl text-lg font-bold text-white shadow-xl shadow-brand-500/25 hover:shadow-brand-500/40 transition-all transform hover:-translate-y-1 inline-flex items-center gap-3">
                 Explore EduVerse AI <ArrowRight size={20} />
              </Link>
              <p className="text-xs text-slate-500 mt-6">* Prototype available. Consent required for vision features.</p>
           </FadeIn>
        </div>
      </section>

      {/* Fake CheckCircle */}
      <div className="hidden">
         <CheckCircle2 />
      </div>
    </div>
  );
};

// Extracted small component for local scope
const CheckCircle2 = ({size, className}) => (
   <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
)

export default LandingPage;
