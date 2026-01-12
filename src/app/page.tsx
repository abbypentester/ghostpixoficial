'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { Shield, Ghost, Zap, Lock, ArrowRight, Wallet } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [accessId, setAccessId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreateWallet = async () => {
    setLoading(true);
    try {
      const res = await axios.post('/api/wallet/create');
      const { walletId } = res.data;
      // Redirect to dashboard
      router.push(`/dashboard/${walletId}?new=true`);
    } catch {
      alert('Erro ao criar carteira. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleAccessWallet = () => {
    if (!accessId.trim()) return;
    router.push(`/dashboard/${accessId.trim()}`);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans selection:bg-purple-500 selection:text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Ghost className="w-8 h-8 text-purple-500" />
            <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
              GhostPIX
            </span>
          </div>
          <nav className="hidden md:flex space-x-8 text-sm font-medium text-gray-400">
            <a href="#como-funciona" className="hover:text-purple-400 transition">Como Funciona</a>
            <a href="#receber" className="hover:text-purple-400 transition">Gerar PIX</a>
            <a href="#sacar" className="hover:text-purple-400 transition">Consultar & Sacar</a>
          </nav>
          <button 
            onClick={() => document.getElementById('access-section')?.scrollIntoView({ behavior: 'smooth' })}
            className="px-4 py-2 text-sm font-semibold text-purple-400 border border-purple-500/30 rounded-lg hover:bg-purple-500/10 transition"
          >
            Acessar Carteira
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-gray-950 to-gray-950"></div>
        <div className="container mx-auto px-6 relative z-10 text-center">
          <div className="inline-flex items-center space-x-2 bg-purple-900/30 border border-purple-500/30 rounded-full px-4 py-1.5 mb-8">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
            </span>
            <span className="text-xs font-semibold text-purple-300 tracking-wide uppercase">Privacidade Absoluta</span>
          </div>
          
          <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight mb-6">
            O Gateway PIX <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-indigo-400 to-blue-400">
              Invisível & Anônimo
            </span>
          </h1>
          
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
            Receba pagamentos de forma 100% anônima. Sem cadastros, sem CPF e sem expor seus dados. 
            Crie cobranças PIX privadas instantaneamente.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button 
              onClick={handleCreateWallet}
              disabled={loading}
              className="w-full sm:w-auto px-8 py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-purple-900/50 transition transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? 'Criando...' : 'Gerar Meu Primeiro PIX'}
              <ArrowRight className="w-5 h-5" />
            </button>
            <button 
               onClick={() => document.getElementById('access-section')?.scrollIntoView({ behavior: 'smooth' })}
               className="w-full sm:w-auto px-8 py-4 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-xl font-bold text-lg border border-gray-700 transition"
            >
              Já tenho uma chave
            </button>
          </div>
        </div>
      </section>

      {/* Access Section */}
      <section id="access-section" className="py-20 bg-black">
        <div className="container mx-auto px-6 max-w-xl">
           <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center shadow-2xl">
              <Lock className="w-12 h-12 text-purple-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">Acessar Carteira Anônima</h2>
              <p className="text-gray-400 mb-6">Insira sua chave mestra para acessar seus fundos.</p>
              
              <div className="space-y-4">
                <input 
                  type="text" 
                  value={accessId}
                  onChange={(e) => setAccessId(e.target.value)}
                  placeholder="Cole sua chave aqui (UUID)"
                  className="w-full bg-black border border-gray-700 rounded-lg px-4 py-3 text-white focus:border-purple-500 focus:outline-none transition text-center font-mono"
                />
                <button 
                  onClick={handleAccessWallet}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-lg font-bold transition"
                >
                  Acessar Agora
                </button>
              </div>
           </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="como-funciona" className="py-20 bg-gray-950">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-3 gap-8">
             <div className="bg-gray-900/50 border border-gray-800 p-8 rounded-2xl hover:border-purple-500/50 transition duration-300">
               <div className="bg-purple-900/20 p-3 rounded-xl w-fit mb-6">
                 <Wallet className="w-8 h-8 text-purple-400" />
               </div>
               <h3 className="text-xl font-bold mb-3">1. Gere sua Carteira</h3>
               <p className="text-gray-400">
                 Crie uma carteira PIX instantânea sem fornecer nenhum dado pessoal. Receba uma chave mestra única.
               </p>
             </div>
             <div className="bg-gray-900/50 border border-gray-800 p-8 rounded-2xl hover:border-purple-500/50 transition duration-300">
               <div className="bg-purple-900/20 p-3 rounded-xl w-fit mb-6">
                 <Shield className="w-8 h-8 text-purple-400" />
               </div>
               <h3 className="text-xl font-bold mb-3">2. Receba PIX</h3>
               <p className="text-gray-400">
                 Gere QR Codes PIX anônimos. O pagador vê apenas &quot;GhostPIX User&quot; ou um nome genérico.
               </p>
             </div>
             <div className="bg-gray-900/50 border border-gray-800 p-8 rounded-2xl hover:border-purple-500/50 transition duration-300">
               <div className="bg-purple-900/20 p-3 rounded-xl w-fit mb-6">
                 <Zap className="w-8 h-8 text-purple-400" />
               </div>
               <h3 className="text-xl font-bold mb-3">3. Saque Rápido</h3>
               <p className="text-gray-400">
                 Saque para qualquer chave PIX (CPF, Email, Aleatória). Limite de segurança de R$ 150/hora.
               </p>
             </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-black py-8">
        <div className="container mx-auto px-6 text-center text-gray-500 text-sm">
          <p>© 2024 GhostPIX. Privacidade é um direito.</p>
        </div>
      </footer>
    </div>
  );
}
