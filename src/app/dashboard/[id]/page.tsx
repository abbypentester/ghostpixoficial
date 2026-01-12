'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { 
  ArrowDownCircle, ArrowUpCircle, Clock, 
  Copy, RefreshCw, AlertTriangle, LogOut, Lock, Shield,
  CheckCircle, XCircle
} from 'lucide-react';
import Link from 'next/link';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  netAmount: number;
  status: string;
  description: string;
  createdAt: string;
  pixCode?: string;
}

interface WalletData {
  id: string;
  balance: number;
  transactions: Transaction[];
}

export default function Dashboard() {
  const params = useParams();
  const searchParams = useSearchParams();
  const walletId = params.id as string;
  const isNew = searchParams.get('new') === 'true';

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'deposit' | 'withdraw'>('overview');
  
  // Deposit State
  const [depositAmount, setDepositAmount] = useState('');
  const [generatedPix, setGeneratedPix] = useState<{code: string, image: string} | null>(null);
  const [generatingPix, setGeneratingPix] = useState(false);

  // Withdraw State
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState('RANDOM_KEY');
  const [destName, setDestName] = useState('');
  const [destDoc, setDestDoc] = useState('');
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawMsg, setWithdrawMsg] = useState<{type: 'success'|'error', text: string} | null>(null);

  const fetchWallet = useCallback(async () => {
    try {
      const res = await axios.get(`/api/wallet/${walletId}`);
      setWallet(res.data);
    } catch (error) {
      console.error(error);
      // Don't alert on interval fetch to avoid spamming
      if (loading) alert("Erro ao carregar carteira. Verifique o ID.");
    } finally {
      setLoading(false);
    }
  }, [walletId, loading]);

  useEffect(() => {
    if (walletId) fetchWallet();
    const interval = setInterval(fetchWallet, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [walletId, fetchWallet]);

  const handleGeneratePix = async () => {
    if (!depositAmount || Number(depositAmount) <= 0) return;
    setGeneratingPix(true);
    setGeneratedPix(null);
    try {
      const res = await axios.post('/api/pix/generate', {
        walletId,
        amount: Number(depositAmount)
      });
      setGeneratedPix({
        code: res.data.pixCode,
        image: res.data.pixCodeBase64
      });
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar PIX");
    } finally {
      setGeneratingPix(false);
    }
  };

  const handleWithdraw = async () => {
    setWithdrawMsg(null);
    if (!withdrawAmount || !pixKey) {
      setWithdrawMsg({ type: 'error', text: 'Preencha valor e chave PIX' });
      return;
    }
    setWithdrawing(true);
    try {
      await axios.post('/api/withdraw', {
        walletId,
        amount: Number(withdrawAmount),
        key: pixKey,
        keyType: pixKeyType,
        name: destName || "Ghost User",
        document: destDoc || "00000000000" 
      });
      
      setWithdrawMsg({ type: 'success', text: 'Saque solicitado com sucesso!' });
      setWithdrawAmount('');
      setPixKey('');
      fetchWallet();
    } catch (error: unknown) {
      let errorMsg = 'Erro ao processar saque';
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        errorMsg = error.response.data.error;
      }
      setWithdrawMsg({ 
        type: 'error', 
        text: errorMsg
      });
    } finally {
      setWithdrawing(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copiado!");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
      </div>
    );
  }

  if (!wallet) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <AlertTriangle className="h-16 w-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">Carteira não encontrada</h1>
        <p className="text-gray-400 mb-6">Verifique se o link está correto.</p>
        <Link href="/" className="px-6 py-2 bg-green-600 rounded hover:bg-green-700 transition">
          Voltar ao Início
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
      {/* Header */}
      <header className="border-b border-gray-800 bg-black/50 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                <span className="font-bold text-black">G</span>
              </div>
              <span className="font-bold text-xl tracking-tight hidden sm:block">GhostPIX</span>
            </Link>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Saldo Atual</p>
              <p className="text-xl font-bold text-green-400">
                R$ {wallet.balance.toFixed(2)}
              </p>
            </div>
            <button 
              onClick={() => fetchWallet()}
              className="p-2 hover:bg-gray-800 rounded-full transition"
              title="Atualizar"
            >
              <RefreshCw className="h-5 w-5 text-gray-400" />
            </button>
            <Link href="/" className="p-2 hover:bg-gray-800 rounded-full transition" title="Sair">
              <LogOut className="h-5 w-5 text-gray-400" />
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        
        {/* Wallet ID Warning */}
        {isNew && (
          <div className="mb-8 bg-green-900/20 border border-green-500/50 rounded-lg p-4 flex items-start gap-3">
            <Lock className="h-6 w-6 text-green-500 shrink-0 mt-1" />
            <div>
              <h3 className="font-bold text-green-400 mb-1">Guarde sua Chave Mestra!</h3>
              <p className="text-sm text-gray-300 mb-2">
                Esta URL é o único acesso aos seus fundos. Se você perdê-la, não haverá como recuperar seu saldo.
                Nós não armazenamos seus dados pessoais.
              </p>
              <div className="bg-black/50 p-2 rounded flex items-center justify-between gap-2 border border-gray-700">
                <code className="text-xs sm:text-sm text-gray-300 truncate font-mono">
                  {walletId}
                </code>
                <button 
                  onClick={() => copyToClipboard(walletId)}
                  className="text-gray-400 hover:text-white"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Mobile Balance */}
        <div className="sm:hidden mb-6 bg-gray-900 p-4 rounded-xl border border-gray-800 text-center">
          <p className="text-gray-400 text-sm mb-1">Saldo Disponível</p>
          <p className="text-3xl font-bold text-green-400">R$ {wallet.balance.toFixed(2)}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition ${
              activeTab === 'overview' 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
            }`}
          >
            Visão Geral
          </button>
          <button
            onClick={() => setActiveTab('deposit')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition flex items-center gap-2 ${
              activeTab === 'deposit' 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
            }`}
          >
            <ArrowDownCircle className="h-4 w-4" />
            Receber (Cash-in)
          </button>
          <button
            onClick={() => setActiveTab('withdraw')}
            className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition flex items-center gap-2 ${
              activeTab === 'withdraw' 
                ? 'bg-green-600 text-white' 
                : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
            }`}
          >
            <ArrowUpCircle className="h-4 w-4" />
            Sacar (Cash-out)
          </button>
        </div>

        {/* Tab Content */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 min-h-[400px]">
          
          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div>
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Clock className="h-5 w-5 text-green-500" />
                Histórico de Transações
              </h2>
              
              {wallet.transactions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>Nenhuma transação encontrada.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {wallet.transactions.map((tx) => (
                    <div key={tx.id} className="bg-black/30 p-4 rounded-lg border border-gray-800 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        {tx.type === 'CASH_IN' ? (
                          <div className="p-2 bg-green-900/30 rounded-full">
                            <ArrowDownCircle className="h-5 w-5 text-green-500" />
                          </div>
                        ) : (
                          <div className="p-2 bg-red-900/30 rounded-full">
                            <ArrowUpCircle className="h-5 w-5 text-red-500" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-white">
                            {tx.type === 'CASH_IN' ? 'Recebimento PIX' : 'Saque PIX'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(tx.createdAt).toLocaleString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${
                          tx.type === 'CASH_IN' ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {tx.type === 'CASH_IN' ? '+' : '-'} R$ {tx.amount.toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {tx.status}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* DEPOSIT TAB */}
          {activeTab === 'deposit' && (
            <div className="max-w-md mx-auto">
              <h2 className="text-xl font-bold mb-6 text-center">Gerar Cobrança PIX</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Valor a Receber (R$)</label>
                  <input
                    type="number"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-black border border-gray-700 rounded-lg p-3 text-white focus:border-green-500 focus:outline-none transition"
                  />
                  <p className="text-xs text-gray-500 mt-1">Taxa de serviço: 10% será descontado do valor recebido.</p>
                </div>

                <button
                  onClick={handleGeneratePix}
                  disabled={generatingPix || !depositAmount}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold transition flex items-center justify-center gap-2"
                >
                  {generatingPix ? (
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Shield className="h-5 w-5" />
                      Gerar QR Code Seguro
                    </>
                  )}
                </button>
              </div>

              {generatedPix && (
                <div className="mt-8 p-6 bg-white rounded-xl flex flex-col items-center animate-in fade-in slide-in-from-bottom-4">
                  <h3 className="text-black font-bold mb-4">Escaneie para Pagar</h3>
                  {generatedPix.image ? (
                    <img 
                      src={`data:image/png;base64,${generatedPix.image}`} 
                      alt="PIX QR Code" 
                      className="w-48 h-48 mb-4"
                    />
                  ) : (
                     <div className="w-48 h-48 bg-gray-200 mb-4 flex items-center justify-center text-gray-500">
                       QR Code Indisponível
                     </div>
                  )}
                  
                  <div className="w-full flex gap-2">
                    <input 
                      readOnly 
                      value={generatedPix.code}
                      className="flex-1 bg-gray-100 border border-gray-300 rounded px-3 py-2 text-sm text-gray-800"
                    />
                    <button 
                      onClick={() => copyToClipboard(generatedPix.code)}
                      className="bg-green-600 text-white px-4 rounded hover:bg-green-700"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* WITHDRAW TAB */}
          {activeTab === 'withdraw' && (
            <div className="max-w-md mx-auto">
              <h2 className="text-xl font-bold mb-6 text-center">Realizar Saque</h2>
              
              {withdrawMsg && (
                <div className={`p-4 rounded-lg mb-6 flex items-center gap-3 ${
                  withdrawMsg.type === 'success' 
                    ? 'bg-green-900/30 border border-green-800 text-green-400' 
                    : 'bg-red-900/30 border border-red-800 text-red-400'
                }`}>
                  {withdrawMsg.type === 'success' ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                  <p>{withdrawMsg.text}</p>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Valor do Saque (R$)</label>
                  <input
                    type="number"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-black border border-gray-700 rounded-lg p-3 text-white focus:border-green-500 focus:outline-none transition"
                  />
                  <p className="text-xs text-gray-500 mt-1">Limite: R$ 150,00/hora. Taxa: 10%.</p>
                </div>

                <div className="grid grid-cols-3 gap-2">
                   <div>
                      <label className="block text-sm text-gray-400 mb-1">Tipo Chave</label>
                      <select 
                        value={pixKeyType}
                        onChange={(e) => setPixKeyType(e.target.value)}
                        className="w-full bg-black border border-gray-700 rounded-lg p-3 text-white text-sm focus:border-green-500 focus:outline-none"
                      >
                        <option value="CPF">CPF</option>
                        <option value="EMAIL">Email</option>
                        <option value="PHONE">Telefone</option>
                        <option value="RANDOM_KEY">Aleatória</option>
                      </select>
                   </div>
                   <div className="col-span-2">
                      <label className="block text-sm text-gray-400 mb-1">Chave PIX</label>
                      <input
                        type="text"
                        value={pixKey}
                        onChange={(e) => setPixKey(e.target.value)}
                        placeholder="Chave PIX destino"
                        className="w-full bg-black border border-gray-700 rounded-lg p-3 text-white focus:border-green-500 focus:outline-none transition"
                      />
                   </div>
                </div>

                {/* Optional fields for SuitPay validation if needed */}
                <div className="pt-2 border-t border-gray-800 mt-2">
                   <p className="text-xs text-gray-500 mb-2">Dados do Destinatário (Opcional para chaves aleatórias)</p>
                   <div className="grid grid-cols-2 gap-2">
                     <input
                        type="text"
                        value={destName}
                        onChange={(e) => setDestName(e.target.value)}
                        placeholder="Nome Completo"
                        className="w-full bg-black border border-gray-700 rounded-lg p-3 text-white text-sm focus:border-green-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        value={destDoc}
                        onChange={(e) => setDestDoc(e.target.value)}
                        placeholder="CPF/CNPJ"
                        className="w-full bg-black border border-gray-700 rounded-lg p-3 text-white text-sm focus:border-green-500 focus:outline-none"
                      />
                   </div>
                </div>

                <button
                  onClick={handleWithdraw}
                  disabled={withdrawing || !withdrawAmount || !pixKey}
                  className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold transition flex items-center justify-center gap-2 mt-4"
                >
                  {withdrawing ? (
                    <RefreshCw className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <LogOut className="h-5 w-5" />
                      Solicitar Saque
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
