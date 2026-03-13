import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Shield, Zap, Globe, Cpu } from 'lucide-react';

const Landing = () => {
    const navigate = useNavigate();
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const [images, setImages] = useState([]);
    const [isLoaded, setIsLoaded] = useState(false);

    // Sequence configuration
    const frameCount = 192;
    const scrollHeight = 5000; // Total scrollable height in pixels

    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start start", "end end"]
    });

    const smoothProgress = useSpring(scrollYProgress, {
        stiffness: 100,
        damping: 30,
        restDelta: 0.001
    });

    const frameIndex = useTransform(smoothProgress, [0, 1], [0, frameCount - 1]);

    // Preload images
    useEffect(() => {
        const preloadImages = async () => {
            const loadedImages = [];
            const promises = [];

            for (let i = 0; i < frameCount; i++) {
                const img = new Image();
                // Match the filename pattern: frame_000_delay-0.041s.webp
                const paddedIndex = String(i).padStart(3, '0');
                img.src = `/assets/landing-sequence/frame_${paddedIndex}_delay-0.041s.webp`;
                promises.push(new Promise((resolve) => {
                    img.onload = () => resolve(img);
                }));
                loadedImages.push(img);
            }

            await Promise.all(promises);
            setImages(loadedImages);
            setIsLoaded(true);
        };

        preloadImages();
    }, []);

    // Render loop
    useEffect(() => {
        if (!isLoaded || !canvasRef.current) return;

        const ctx = canvasRef.current.getContext('2d');
        let animationFrameId;

        const render = () => {
            const currentFrame = Math.floor(frameIndex.get());
            const img = images[currentFrame];

            if (img && ctx) {
                // Cover behavior
                const canvas = canvasRef.current;
                const scale = Math.max(canvas.width / img.width, canvas.height / img.height);
                const x = (canvas.width / 2) - (img.width / 2) * scale;
                const y = (canvas.height / 2) - (img.height / 2) * scale;
                
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
            }
            animationFrameId = requestAnimationFrame(render);
        };

        const handleResize = () => {
            if (canvasRef.current) {
                canvasRef.current.width = window.innerWidth;
                canvasRef.current.height = window.innerHeight;
            }
        };

        window.addEventListener('resize', handleResize);
        handleResize();
        render();

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', handleResize);
        };
    }, [isLoaded, images, frameIndex]);

    return (
        <div ref={containerRef} className="relative bg-black" style={{ height: `${scrollHeight}px` }}>
            {/* Canvas Stickiness */}
            <div className="sticky top-0 h-screen w-full overflow-hidden">
                <canvas 
                    ref={canvasRef} 
                    className="w-full h-full object-cover pointer-events-none opacity-60"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
            </div>

            {/* Content Sections */}
            <div className="relative z-10 -mt-[100vh]">
                {/* Hero Section */}
                <section className="h-screen flex flex-col items-center justify-center px-6 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 1 }}
                        className="max-w-5xl"
                    >
                        <span className="inline-block text-blue-500 font-black tracking-[0.3em] uppercase mb-6 text-sm">
                            Next-Generation Trade Intelligence
                        </span>
                        <h1 className="text-6xl md:text-8xl font-black text-white mb-8 tracking-tighter leading-none">
                            THE <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-600">FUTURE</span> OF<br />GLOBAL LOGISTICS
                        </h1>
                        <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10 font-medium">
                            Unified intelligence for the modern supply chain. Monitor, optimize, and scale your global operations with neural-powered visibility.
                        </p>
                        <div className="flex flex-col md:flex-row gap-6 justify-center">
                            <button 
                                onClick={() => navigate('/dashboard')}
                                className="group bg-blue-600 hover:bg-blue-700 text-white px-10 py-5 rounded-2xl font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 flex items-center justify-center gap-3 shadow-2xl shadow-blue-500/20"
                            >
                                Enter Command Center
                                <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                            </button>
                            <button className="bg-white/5 hover:bg-white/10 text-white border border-white/10 px-10 py-5 rounded-2xl font-black uppercase tracking-widest transition-all backdrop-blur-xl">
                                System Overview
                            </button>
                        </div>
                    </motion.div>
                </section>

                {/* Intelligence Section */}
                <section className="h-screen flex items-center justify-center px-6">
                    <motion.div 
                        initial={{ opacity: 0, x: -50 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ margin: "-20%" }}
                        className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-7xl items-center"
                    >
                        <div>
                            <div className="w-16 h-16 bg-blue-600/20 rounded-2xl flex items-center justify-center mb-8 border border-blue-500/30">
                                <Cpu className="text-blue-500" size={32} />
                            </div>
                            <h2 className="text-5xl font-black text-white mb-6 tracking-tight">Neural Supply Chain <br /><span className="text-blue-500">Optimization</span></h2>
                            <p className="text-lg text-gray-400 font-medium leading-relaxed">
                                Our proprietary AI engines process millions of data points across the trade lake to identify bottlenecks before they happen.
                            </p>
                        </div>
                    </motion.div>
                </section>

                {/* Security Section */}
                <section className="h-screen flex items-center justify-center px-6">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ spring: { stiffness: 100, damping: 20 } }}
                        className="text-right max-w-7xl w-full flex flex-col items-end"
                    >
                        <div className="w-16 h-16 bg-emerald-600/20 rounded-2xl flex items-center justify-center mb-8 border border-emerald-500/30">
                            <Shield className="text-emerald-500" size={32} />
                        </div>
                        <h2 className="text-5xl font-black text-white mb-6 tracking-tight">Enterprise-Grade <br /><span className="text-emerald-500">Audit Security</span></h2>
                        <p className="text-lg text-gray-400 font-medium leading-relaxed max-w-xl">
                            Every transaction and movement is logged on our immutable ledger, ensuring 100% compliance across all international ports and hubs.
                        </p>
                    </motion.div>
                </section>

                {/* Footer Section */}
                <section className="h-screen flex items-center justify-center px-6">
                    <div className="text-center">
                        <motion.div
                            initial={{ opacity: 0, y: 50 }}
                            whileInView={{ opacity: 1, y: 0 }}
                        >
                            <h2 className="text-7xl font-black text-white mb-12 tracking-tighter">READY TO <span className="text-blue-500">SCALE?</span></h2>
                            <button 
                                onClick={() => navigate('/dashboard')}
                                className="bg-white text-black px-16 py-6 rounded-3xl font-black uppercase tracking-[0.2em] transform hover:scale-110 active:scale-95 transition-all shadow-[0_0_50px_rgba(255,255,255,0.2)]"
                            >
                                Launch Platform
                            </button>
                            <div className="mt-20 text-[10px] text-gray-600 font-black uppercase tracking-[0.5em]">
                                Trade Intelligence Platform © 2026 • KIT Hackathon Edition
                            </div>
                        </motion.div>
                    </div>
                </section>
            </div>

            {/* Loading Overlay */}
            {!isLoaded && (
                <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center">
                    <div className="w-64 h-1 bg-white/10 rounded-full mb-4 overflow-hidden">
                        <motion.div 
                            className="h-full bg-blue-600"
                            initial={{ width: 0 }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 2, ease: "easeInOut" }}
                        />
                    </div>
                    <span className="text-white font-black text-[10px] uppercase tracking-[0.5em] animate-pulse">Initializing Systems</span>
                </div>
            )}
        </div>
    );
};

export default Landing;
