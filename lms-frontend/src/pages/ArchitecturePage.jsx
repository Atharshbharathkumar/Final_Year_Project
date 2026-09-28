import React from 'react';
import { GlassCard, Button } from '../components/ui/Components';
import { Server, Database, Code2, Cpu, Globe, Lock, Workflow, AlignEndHorizontal } from 'lucide-react';

const ArchitecturePage = () => {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <AlignEndHorizontal size={24} className="text-brand-400" /> System Architecture
        </h1>
        <p className="text-sm text-slate-400 mt-1">Overview of the EduVerse AI infrastructure and technology stack.</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-8 items-start">
         <GlassCard hover={false} className="space-y-8">
            <div className="text-center">
               <h3 className="text-lg font-semibold text-white mb-6">Data Flow Diagram</h3>
               <div className="flex flex-col items-center space-y-3 relative">
                  {/* Edges */}
                  <div className="absolute top-[30px] bottom-[30px] w-0.5 bg-gradient-to-b from-brand-500 via-violet-500 to-emerald-500 opacity-30 -z-10" />
                  
                  {/* Nodes */}
                  <div className="w-full max-w-xs p-4 rounded-xl bg-dark-bg border border-dark-border shadow-lg flex items-center justify-center gap-2 relative z-10 transition-transform hover:scale-105">
                     <Globe size={18} className="text-slate-400" />
                     <span className="font-semibold text-white text-sm">Client Browser / App</span>
                     <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-4 h-4 bg-dark-bg border border-dark-border rotate-45 border-t-0 border-l-0" />
                  </div>
                  
                  <div className="w-full max-w-xs p-4 rounded-xl bg-brand-950/40 border border-brand-500/40 shadow-lg shadow-brand-500/10 flex items-center justify-center gap-3 relative z-10 transition-transform hover:scale-105">
                     <Code2 size={24} className="text-brand-500" />
                     <div className="text-left">
                        <p className="font-bold text-brand-100 text-sm">React Frontend</p>
                        <p className="text-[10px] text-brand-300">Vite, Tailwind, Recharts</p>
                     </div>
                     <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-4 h-4 bg-brand-950/40 border border-brand-500/40 rotate-45 border-t-0 border-l-0" />
                  </div>
                  
                  <div className="w-full max-w-xs p-4 rounded-xl bg-violet-950/40 border border-violet-500/40 shadow-lg shadow-violet-500/10 flex items-center justify-center gap-3 relative z-10 transition-transform hover:scale-105">
                     <Server size={24} className="text-violet-500" />
                     <div className="text-left">
                        <p className="font-bold text-violet-100 text-sm">FastAPI / Spring Boot</p>
                        <p className="text-[10px] text-violet-300">REST APIs & WebSockets</p>
                     </div>
                     <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-4 h-4 bg-violet-950/40 border border-violet-500/40 rotate-45 border-t-0 border-l-0" />
                  </div>
                  
                  <div className="flex gap-4 w-full justify-center relative z-10 pt-2">
                     <div className="w-40 p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 shadow-lg hover:scale-105 transition-transform text-center relative">
                        <Database size={20} className="text-emerald-500 mx-auto mb-2" />
                        <p className="font-bold text-emerald-100 text-sm">PostgreSQL</p>
                        <p className="text-[10px] text-emerald-300">Core State & Data</p>
                     </div>
                     <div className="w-40 p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 shadow-lg hover:scale-105 transition-transform text-center">
                        <Cpu size={20} className="text-amber-500 mx-auto mb-2" />
                        <p className="font-bold text-amber-100 text-sm">ML Vision Engine</p>
                        <p className="text-[10px] text-amber-300">OpenCV, YOLO, L2CS</p>
                     </div>
                  </div>
               </div>
            </div>
         </GlassCard>

         <div className="space-y-6">
            <GlassCard hover={false}>
               <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Workflow size={16} className="text-brand-400" /> Tech Stack Breakdown
               </h3>
               <div className="space-y-4">
                  <div>
                     <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Frontend</p>
                     <div className="flex flex-wrap gap-2">
                        {['React 18', 'Vite', 'Tailwind CSS', 'Recharts', 'Lucide Icons', 'Framer Motion'].map(t => (
                           <span key={t} className="px-2 py-1 rounded bg-dark-bg border border-dark-border text-xs text-slate-300">{t}</span>
                        ))}
                     </div>
                  </div>
                  <div>
                     <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Backend & APIs</p>
                     <div className="flex flex-wrap gap-2">
                        {['Python FastAPI', 'Java Spring Boot', 'WebSockets', 'REST', 'JWT Auth'].map(t => (
                           <span key={t} className="px-2 py-1 rounded bg-dark-bg border border-dark-border text-xs text-slate-300">{t}</span>
                        ))}
                     </div>
                  </div>
                  <div>
                     <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">AI / Machine Learning</p>
                     <div className="flex flex-wrap gap-2">
                        {['OpenCV', 'MediaPipe Face Mesh', 'YOLO', 'L2CS-Net', 'InsightFace', 'Scikit-Learn'].map(t => (
                           <span key={t} className="px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300">{t}</span>
                        ))}
                     </div>
                  </div>
               </div>
            </GlassCard>
            
            <GlassCard hover={false}>
               <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Lock size={16} className="text-emerald-400" /> Security & Privacy Design
               </h3>
               <ul className="space-y-2 text-sm text-slate-300">
                  <li className="flex items-start gap-2">
                     <div className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                     <p>Stateless JWT authentication with rotating refresh tokens.</p>
                  </li>
                  <li className="flex items-start gap-2">
                     <div className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                     <p>No video feeds are saved natively unless explicitly requested by the institution.</p>
                  </li>
                  <li className="flex items-start gap-2">
                     <div className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                     <p>Role-Based Access Control (RBAC) securely separates Student, Teacher, Parent, and Admin views.</p>
                  </li>
                  <li className="flex items-start gap-2">
                     <div className="mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                     <p>AI inference operates either entirely in-browser (TensorFlow.js) or via secure isolated microservices.</p>
                  </li>
               </ul>
            </GlassCard>
         </div>
      </div>
    </div>
  );
};

export default ArchitecturePage;
