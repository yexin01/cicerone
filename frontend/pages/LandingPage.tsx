/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useEffect } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Plane, MessageCircle, ArrowRight, Compass } from 'lucide-react';
import { Itinerary } from '../../shared/types';

interface LandingPageProps {
  savedPlans: Itinerary[];
  onStartPlanning: () => void;
  onOpenChat: () => void;
  onSelectPlan: (plan: Itinerary) => void;
}

const InteractiveRobot = () => {
    const ref = useRef<HTMLDivElement>(null);
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const mouseX = useSpring(x, { stiffness: 150, damping: 15 });
    const mouseY = useSpring(y, { stiffness: 150, damping: 15 });

    useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
        if (ref.current) {
          const rect = ref.current.getBoundingClientRect();
          // Calculate mouse position relative to center of the image
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          
          x.set((e.clientX - centerX) / 30); // Reduced sensitivity for smoother feel
          y.set((e.clientY - centerY) / 30);
        }
      };

      window.addEventListener('mousemove', handleMouseMove);
      return () => window.removeEventListener('mousemove', handleMouseMove);
    }, [x, y]);

    // Use transforms to simulate 3D looking around
    const rotateX = useTransform(mouseY, (val) => -val); 
    const rotateY = useTransform(mouseX, (val) => val);

    // Parallax for bubbles
    const bubbleX = useTransform(mouseX, (val) => val * 1.8);
    const bubbleY = useTransform(mouseY, (val) => val * 1.8);

    const ChatBubble = ({ top, right, delay, scale = 1 }: { top: string, right: string, delay: number, scale?: number }) => (
      <motion.div
        initial={{ opacity: 0, scale: 0, y: 10 }}
        animate={{ opacity: 1, scale: scale, y: 0 }}
        transition={{ delay, duration: 0.5, type: 'spring' }}
        className="absolute p-3 rounded-2xl rounded-bl-sm flex items-center justify-center gap-1 z-20 backdrop-blur-md bg-white/10 dark:bg-zinc-800/40 border border-white/20 shadow-lg ring-1 ring-white/10"
        style={{ 
          top, 
          right, 
          x: bubbleX, 
          y: bubbleY,
          translateZ: 60, // Higher Z for more parallax
          boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
        }}
      >
         <motion.div 
            animate={{ opacity: [0.4, 1, 0.4] }} 
            transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
            className="w-2 h-2 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]" 
         />
         <motion.div 
            animate={{ opacity: [0.4, 1, 0.4] }} 
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
            className="w-2 h-2 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]" 
         />
         <motion.div 
            animate={{ opacity: [0.4, 1, 0.4] }} 
            transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
            className="w-2 h-2 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]" 
         />
      </motion.div>
    );

    return (
      <div className="relative w-full h-[400px] md:h-[500px] flex items-center justify-center perspective-1000">
        <motion.div 
            ref={ref}
            style={{ 
              rotateX, 
              rotateY, 
              transformStyle: "preserve-3d" 
            }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="relative w-64 h-64 md:w-[450px] md:h-[450px]"
        >
             {/* Purple Glow Effect matching reference */}
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-purple-500/20 blur-[100px] rounded-full -z-10" />
             <div className="absolute top-1/4 right-0 w-[80%] h-[80%] bg-blue-500/10 blur-[80px] rounded-full -z-10" />

             {/* Bubbles */}
             <ChatBubble top="5%" right="15%" delay={0.5} />
             <ChatBubble top="25%" right="-5%" delay={0.7} scale={0.8} />
             <ChatBubble top="15%" right="45%" delay={0.9} scale={0.9} />

             {/* Main Robot Body/Head - Using a stable Microsoft Fluent 3D Robot */}
             <motion.img 
               animate={{ y: [0, -15, 0] }}
               transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
               src="https://raw.githubusercontent.com/Tarikul-Islam-Anik/Animated-Fluent-Emojis/master/Emojis/Smilies/Robot.png" 
               alt="Interactive Robot"
               className="w-full h-full object-contain drop-shadow-2xl filter brightness-105 contrast-110"
               style={{ translateZ: 20 }}
             />
        </motion.div>
      </div>
    );
};

const LandingPage: React.FC<LandingPageProps> = ({ savedPlans, onStartPlanning, onOpenChat, onSelectPlan }) => (
      <div className="max-w-7xl mx-auto px-6 py-8 md:py-16">
          <div className="flex flex-col-reverse md:flex-row items-center gap-12">
              {/* Text Content */}
              <div className="flex-1 space-y-8 z-10">
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                  >
                      <h1 className="text-6xl md:text-7xl font-bold font-heading text-zinc-900 dark:text-white leading-tight tracking-tight mb-6">
                        Meet Cicerone
                      </h1>
                      <p className="text-xl md:text-2xl text-zinc-500 dark:text-zinc-400 font-light leading-relaxed max-w-lg">
                         Your technology-forward AI travel buddy. Plan, refine, and follow your trip with an interactive 3D guide.
                      </p>
                  </motion.div>
                  
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="flex flex-col sm:flex-row gap-4"
                  >
                      <button 
                        onClick={onStartPlanning}
                        className="px-8 py-4 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-xl font-bold text-lg hover:scale-105 transition-transform flex items-center justify-center gap-3 shadow-xl shadow-zinc-200 dark:shadow-zinc-900/50"
                      >
                         <Plane className="w-5 h-5" /> Start Planning
                      </button>
                      <button 
                        onClick={onOpenChat}
                        className="px-8 py-4 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-xl font-bold text-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors flex items-center justify-center gap-3"
                      >
                         <MessageCircle className="w-5 h-5" /> Chat with AI
                      </button>
                  </motion.div>
              </div>

              {/* Robot Interaction */}
              <div className="flex-1 w-full">
                  <InteractiveRobot />
              </div>
          </div>

          {/* Saved Journeys Section (Only if exists) */}
          {savedPlans.length > 0 && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="mt-24 pt-12 border-t border-zinc-100 dark:border-zinc-800"
            >
                <h2 className="text-2xl font-bold mb-8 text-zinc-400 uppercase tracking-widest text-sm">Resume Planning</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {savedPlans.map(plan => (
                        <div key={plan.id} onClick={() => onSelectPlan(plan)} className="group bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 cursor-pointer hover:border-primary transition-colors relative overflow-hidden">
                             <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-full group-hover:bg-primary/10 transition-colors" />
                             <h3 className="text-xl font-bold mb-1">{plan.destination}</h3>
                             <p className="text-zinc-500 text-sm mb-4">{plan.days.length} Days</p>
                             <div className="flex items-center text-primary text-sm font-bold gap-1 group-hover:gap-2 transition-all">
                                Continue <ArrowRight className="w-4 h-4" />
                             </div>
                        </div>
                    ))}
                </div>
            </motion.div>
          )}
      </div>
);

export default LandingPage;