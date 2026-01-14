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

  const totalCashIn = wallet?.transactions
    .filter((tx) => tx.type === 'CASH_IN')
    .reduce((sum, tx) => sum + tx.amount, 0) ?? 0;

  const totalCashOut = wallet?.transactions
    .filter((tx) => tx.type === 'CASH_OUT')
    .reduce((sum, tx) => sum + tx.amount, 0) ?? 0;

  const withdrawPreviewAmount = Number(withdrawAmount || 0);
  const withdrawNetAmount = withdrawPreviewAmount > 0 ? withdrawPreviewAmount * 0.85 : 0;

  const getStatusConfig = (status: string) => {
    const normalized = status.toUpperCase();

    if (normalized === 'PENDING') {
      return {
        label: 'Pendente',
        classes: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/30'
      };
    }

    if (normalized === 'COMPLETED' || normalized === 'APPROVED' || normalized === 'PAID') {
      return {
        label: 'Concluída',
        classes: 'bg-green-500/10 text-green-300 border-green-500/30'
      };
    }

    if (normalized === 'FAILED' || normalized === 'CANCELED' || normalized === 'ERROR') {
      return {
        label: 'Falhada',
        classes: 'bg-red-500/10 text-red-300 border-red-500/30'
      };
    }

    return {
      label: status,
      classes: 'bg-gray-500/10 text-gray-300 border-gray-500/30'
    };
  };

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
      <header className="border-b border-gray-800 bg-black/70 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-9 h-9 bg-gradient-to-br from-green-500 to-emerald-400 rounded-xl flex items-center justify-center">
                <span className="font-extrabold text-black text-lg">G</span>
              </div>
              <div className="hidden sm:flex flex-col">
                <span className="font-semibold text-lg leading-tight">GhostPIX</span>
                <span className="text-[11px] text-gray-400 leading-tight">
                  Carteira PIX anônima e instantânea
                </span>
              </div>
            </Link>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-[11px] text-gray-500 uppercase tracking-[0.15em]">
                Saldo disponível
              </p>
              <p className="text-xl font-semibold text-green-400">
                R$ {wallet.balance.toFixed(2)}
              </p>
            </div>
            <button 
              onClick={() => fetchWallet()}
              className="p-2 hover:bg-gray-900 rounded-full transition border border-gray-800"
              title="Atualizar saldo"
            >
              <RefreshCw className="h-5 w-5 text-gray-300" />
            </button>
            <Link
              href="/"
              className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-full border border-gray-800 text-xs text-gray-300 hover:bg-gray-900 transition"
              title="Sair da carteira"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        <section className="bg-gradient-to-br from-gray-900 to-black border border-gray-800 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-green-400 uppercase tracking-[0.2em] mb-1">
              Sua carteira GhostPIX
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold mb-2">
              Controle total do seu saldo em segundos
            </h1>
            <p className="text-sm text-gray-400 max-w-md">
              Gere cobranças PIX, receba pagamentos e saque para qualquer chave
              com segurança e sem burocracia.
            </p>
          </div>
          <div className="w-full sm:w-auto">
            <div className="bg-black/60 border border-green-500/40 rounded-xl px-4 py-3 text-right shadow-lg">
              <p className="text-[11px] text-gray-400 uppercase tracking-[0.18em]">
                Saldo disponível
              </p>
              <p className="text-2xl sm:text-3xl font-bold text-green-400">
                R$ {wallet.balance.toFixed(2)}
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                Atualizado automaticamente a cada 10 segundos
              </p>
            </div>
          </div>
        </section>
        
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

        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-[11px] text-gray-500 uppercase tracking-[0.18em] mb-1">
              Entradas
            </p>
            <p className="text-lg font-semibold text-green-400">
              R$ {totalCashIn.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Total recebido via PIX nesta carteira
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-[11px] text-gray-500 uppercase tracking-[0.18em] mb-1">
              Saques
            </p>
            <p className="text-lg font-semibold text-red-400">
              R$ {totalCashOut.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Total já solicitado em cash-out
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
            <Shield className="h-6 w-6 text-green-500 shrink-0" />
            <div>
              <p className="text-sm font-medium">Segurança primeiro</p>
              <p className="text-xs text-gray-500">
                PIX processado pela SuitPay e carteira anônima, sem burocracia.
              </p>
            </div>
          </div>
        </section>

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
              <h2 className="text-xl font-bold mb-2 flex items-center gap-2">
                <Clock className="h-5 w-5 text-green-500" />
                Histórico de Transações
              </h2>
              <p className="text-sm text-gray-400 mb-4">
                Acompanhe tudo o que entrou e saiu da sua carteira em tempo real.
              </p>
              
              {wallet.transactions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>Nenhuma transação encontrada.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {wallet.transactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="bg-black/30 p-4 rounded-lg border border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
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
                          <p className="text-xs text-gray-500 mt-1">
                            Líquido: R$ {tx.netAmount.toFixed(2)} • Taxa: R$ {(tx.amount - tx.netAmount).toFixed(2)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${
                          tx.type === 'CASH_IN' ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {tx.type === 'CASH_IN' ? '+' : '-'} R$ {tx.amount.toFixed(2)}
                        </p>
                        <div className="mt-1 flex justify-end">
                          {(() => {
                            const config = getStatusConfig(tx.status);
                            return (
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-1 text-[11px] border ${config.classes}`}
                              >
                                {config.label}
                              </span>
                            );
                          })()}
                        </div>
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
              <h2 className="text-xl font-bold mb-2 text-center">Receber via PIX</h2>
              <p className="text-sm text-gray-400 text-center mb-6">
                Informe o valor, gere o QR Code e envie o código de pagamento
                para o seu cliente em poucos segundos.
              </p>
              
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
                  <p className="text-xs text-gray-500 mt-1">
                    Taxa de serviço: 15% será descontado do valor recebido.
                  </p>
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
                  <p className="mt-3 text-xs text-gray-500 text-center">
                    Use o botão de copiar para enviar o código PIX por mensagem ou e-mail.
                  </p>
                </div>
              )}

              <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-500">
                <Shield className="h-4 w-4 text-green-500" />
                <span>Transações processadas pela SuitPay, com padrão de segurança bancária.</span>
              </div>
            </div>
          )}

          {/* WITHDRAW TAB */}
          {activeTab === 'withdraw' && (
            <div className="max-w-md mx-auto">
              <h2 className="text-xl font-bold mb-6 text-center">Realizar Saque</h2>

              <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-[11px] text-gray-500 uppercase tracking-[0.18em] mb-1">
                    Saldo disponível
                  </p>
                  <p className="text-lg font-semibold text-green-400">
                    R$ {wallet.balance.toFixed(2)}
                  </p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                  <p className="text-[11px] text-gray-500 uppercase tracking-[0.18em] mb-1">
                    Você recebe líquido (aprox.)
                  </p>
                  <p className="text-lg font-semibold text-white">
                    R$ {withdrawNetAmount.toFixed(2)}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Considerando taxa de 15% sobre o valor do saque
                  </p>
                </div>
              </div>
              
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
                  <p className="text-xs text-gray-500 mt-1">
                    Limite: R$ 150,00/hora. Taxa: 15% sobre o valor do saque.
                  </p>
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
