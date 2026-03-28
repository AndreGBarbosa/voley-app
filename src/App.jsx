import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAnalytics } from "firebase/analytics";
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  onSnapshot, 
  updateDoc, 
  arrayUnion, 
  arrayRemove,
  runTransaction
} from 'firebase/firestore';
import { 
  Users, 
  Calendar, 
  Clock, 
  ShieldCheck, 
  LogOut, 
  PlusCircle, 
  DollarSign, 
  Download,
  CheckCircle2,
  AlertCircle,
  Crown,
  UserPlus,
  UserMinus,
  Lock,
  Trash2,
  History,
  Smartphone,
  Save,
  UserCircle
} from 'lucide-react';

// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAQXrADQKC7ZI2EPYsBl2cKz-hFJkPVOEA",
  authDomain: "voley-app-c3ee1.firebaseapp.com",
  projectId: "voley-app-c3ee1",
  storageBucket: "voley-app-c3ee1.firebasestorage.app",
  messagingSenderId: "693100331235",
  appId: "1:693100331235:web:ce1e921c8004c24884c5d6",
  measurementId: "G-VWE18HV61Z"
};
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'voley-manager-v3';

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('login'); 
  const [activeTab, setActiveTab] = useState('19h'); 
  const [gameData19, setGameData19] = useState({ players: [] });
  const [gameData21, setGameData21] = useState({ players: [] });
  const [allUsers, setAllUsers] = useState([]);
  const [finances, setFinances] = useState({ totalCash: 0, history: [] });
  const [message, setMessage] = useState(null);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [rememberMe, setRememberMe] = useState(false);
  
  const listRef = useRef(null);

  // Script para Captura de Imagem e PWA Prompt
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
    script.async = true;
    document.body.appendChild(script);

    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => { 
      if (document.body.contains(script)) document.body.removeChild(script);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Autenticação e Login Automático
  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      // Tentativa de carregar dados salvos no localStorage
      const savedUser = localStorage.getItem(`voley_saved_user_${appId}`);
      const savedPass = localStorage.getItem(`voley_saved_pass_${appId}`);
      
      if (savedUser && savedPass) {
        setRememberMe(true);
      }

      if (u) {
        fetchUserData(u.uid);
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Listener para usuários (necessário para validar login automático quando os dados chegarem)
  useEffect(() => {
    if (allUsers.length > 0 && !userData && view === 'login') {
      const savedUser = localStorage.getItem(`voley_saved_user_${appId}`);
      const savedPass = localStorage.getItem(`voley_saved_pass_${appId}`);
      
      if (savedUser && savedPass) {
        const found = allUsers.find(u => u.username === savedUser && u.password === savedPass);
        if (found) {
          setUserData(found);
          setView('dashboard');
        }
      }
    }
  }, [allUsers]);

  const fetchUserData = async (uid) => {
    const userDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', uid));
    if (userDoc.exists()) {
      setUserData(userDoc.data());
      setView('dashboard');
    } else {
      // Se não tem documento vinculado ao UID, mas temos login salvo no localStorage, 
      // o useEffect de allUsers cuidará disso. Se não, fica no login/signup.
      if (!localStorage.getItem(`voley_saved_user_${appId}`)) {
        setView('login');
      }
    }
    setLoading(false);
  };

  // Listeners em Tempo Real
  useEffect(() => {
    if (!user) return;

    const unsub19 = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'games', '19h'), (d) => {
      setGameData19(d.exists() ? d.data() : { players: [] });
    });
    const unsub21 = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'games', '21h'), (d) => {
      setGameData21(d.exists() ? d.data() : { players: [] });
    });
    const unsubUsers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'users'), (s) => {
      setAllUsers(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubFin = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'finances', 'main'), (d) => {
      if (d.exists()) setFinances(d.data());
    });

    return () => { unsub19(); unsub21(); unsubUsers(); unsubFin(); };
  }, [user]);

  // --- LÓGICA DE NEGÓCIO ---

  const handleInstallApp = async () => {
    if (!installPrompt) {
      showMessage("Para instalar no iPhone: Toque no ícone de compartilhar e depois em 'Adicionar à Tela de Início'.", "info");
      return;
    }
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const updatedData = {
      ...userData,
      firstName: f.get('firstName'),
      lastName: f.get('lastName'),
      congregation: f.get('congregation'),
      username: `${f.get('lastName')}.${f.get('firstName')}`
    };
    
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), updatedData);
      setUserData(updatedData);
      showMessage("Cadastro atualizado com sucesso!", "success");
    } catch (e) {
      showMessage("Erro ao salvar cadastro", "error");
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const uIn = e.target.username.value;
    const pIn = e.target.password.value;
    const found = allUsers.find(u => u.username === uIn && u.password === pIn);
    
    if (found) {
      if (rememberMe) {
        localStorage.setItem(`voley_saved_user_${appId}`, uIn);
        localStorage.setItem(`voley_saved_pass_${appId}`, pIn);
      } else {
        localStorage.removeItem(`voley_saved_user_${appId}`);
        localStorage.removeItem(`voley_saved_pass_${appId}`);
      }
      setUserData(found);
      setView('dashboard');
      showMessage("Bem-vindo de volta!", "success");
    } else {
      showMessage("Usuário ou senha inválidos", "error");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(`voley_saved_user_${appId}`);
    localStorage.removeItem(`voley_saved_pass_${appId}`);
    setUserData(null);
    setView('login');
    setRememberMe(false);
  };

  const getListAccess = (court) => {
    const now = new Date();
    const day = now.getDay(); 
    const hour = now.getHours();

    if (userData?.isMaster || userData?.isAdmin) return { canSee: true, canJoin: true };

    const isBeforeThu13 = day < 4 || (day === 4 && hour < 13);
    if (isBeforeThu13) return { canSee: false, canJoin: false, reason: 'A lista abre quinta-feira às 13:00.' };

    const isMensalistaPeriod = (day === 4 && hour >= 13) || (day === 5 && hour < 13);
    if (isMensalistaPeriod) {
      const isMonthly = court === '19h' ? userData?.isMonthly19 : userData?.isMonthly21;
      if (isMonthly) return { canSee: true, canJoin: true };
      return { 
        canSee: false, 
        canJoin: false, 
        reason: `Este horário é exclusivo para mensalistas das ${court} até sexta às 13:00.` 
      };
    }

    return { canSee: true, canJoin: true };
  };

  const handleJoinGame = async (court) => {
    const access = getListAccess(court);
    if (!access.canJoin) return showMessage(access.reason, 'error');

    try {
      await runTransaction(db, async (transaction) => {
        const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', court);
        const gameDoc = await transaction.get(gameRef);
        let players = gameDoc.exists() ? gameDoc.data().players : [];

        if (players.length >= 24) throw new Error("Lista cheia! Limite de 24 atingido.");
        if (players.some(p => p.uid === user.uid)) throw new Error("Você já está nesta lista.");

        const newPlayer = {
          uid: user.uid,
          name: `${userData.lastName}.${userData.firstName}`,
          congregation: userData.congregation,
          time: new Date().toISOString()
        };

        transaction.set(gameRef, { players: [...players, newPlayer] }, { merge: true });
      });
      showMessage("Nome adicionado com sucesso!", "success");
    } catch (e) { showMessage(e.message, 'error'); }
  };

  const handleRemovePlayer = async (court, uid) => {
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', court);
    const list = court === '19h' ? gameData19 : gameData21;
    const player = list.players.find(p => p.uid === uid);
    if (player) await updateDoc(gameRef, { players: arrayRemove(player) });
  };

  const resetList = async (court) => {
    if (!window.confirm(`Deseja realmente limpar a lista das ${court}?`)) return;
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', court), { players: [] });
    showMessage(`Lista das ${court} limpa!`, "success");
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const isFirst = allUsers.length === 0;
    const info = {
      firstName: f.get('firstName'),
      lastName: f.get('lastName'),
      congregation: f.get('congregation'),
      password: f.get('password'),
      username: `${f.get('lastName')}.${f.get('firstName')}`,
      isMonthly19: false,
      isMonthly21: false,
      isAdmin: isFirst,
      isMaster: isFirst,
      createdAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), info);
    setUserData(info);
    setView('dashboard');
  };

  const toggleUserField = async (userId, field, current) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', userId), { [field]: !current });
  };

  const addFinance = async (e) => {
    e.preventDefault();
    const val = parseFloat(e.target.amount.value);
    const newRecord = {
      amount: val,
      desc: e.target.desc.value,
      date: new Date().toISOString(),
      admin: userData.username
    };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'finances', 'main'), {
      totalCash: (finances.totalCash || 0) + val,
      history: arrayUnion(newRecord)
    }, { merge: true });
    e.target.reset();
    showMessage("Financeiro atualizado!", "success");
  };

  const downloadJPG = () => {
    if (!window.html2canvas) return showMessage("Aguarde o carregamento...", "info");
    window.html2canvas(listRef.current, { backgroundColor: '#ffffff', scale: 2 }).then(canvas => {
      const a = document.createElement('a');
      a.download = `Volei_${activeTab}_${new Date().toLocaleDateString()}.jpg`;
      a.href = canvas.toDataURL('image/jpeg', 0.8);
      a.click();
    });
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3500);
  };

  if (loading) return <div className="h-screen bg-indigo-900 flex items-center justify-center text-white font-black animate-pulse uppercase tracking-widest">Iniciando Vôlei Elite...</div>;

  const currentAccess = getListAccess(activeTab);
  const currentList = activeTab === '19h' ? gameData19 : gameData21;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-32">
      {message && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4 ${message.type === 'error' ? 'bg-red-600' : message.type === 'success' ? 'bg-green-600' : 'bg-indigo-600'} text-white font-bold`}>
          {message.type === 'error' ? <AlertCircle size={20}/> : <CheckCircle2 size={20}/>}
          {message.text}
        </div>
      )}

      {userData && (
        <header className="bg-indigo-800 text-white p-4 shadow-xl sticky top-0 z-50">
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Calendar size={22} className="text-indigo-300" />
              <h1 className="font-black text-xl tracking-tighter italic">VÔLEI ELITE</h1>
            </div>
            <div className="flex items-center gap-4">
               <div className="text-right hidden sm:block">
                  <p className="text-xs font-black leading-none uppercase">{userData.username}</p>
                  <p className="text-[10px] opacity-60 font-bold uppercase">{userData.isMaster ? 'MASTER' : userData.isAdmin ? 'ADMIN' : 'JOGADOR'}</p>
               </div>
               <button onClick={handleLogout} className="p-2 bg-white/10 rounded-xl hover:bg-white/20 transition-all"><LogOut size={20}/></button>
            </div>
          </div>
        </header>
      )}

      <main className="max-w-4xl mx-auto p-4">
        {view === 'login' && (
          <div className="max-w-md mx-auto mt-16 bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100">
            <div className="text-center mb-8">
               <div className="w-20 h-20 bg-indigo-100 rounded-3xl flex items-center justify-center mx-auto mb-4 text-indigo-600"><ShieldCheck size={40}/></div>
               <h2 className="text-3xl font-black text-slate-800">Login</h2>
               <p className="text-slate-400 text-sm mt-1">Bem-vindo ao sistema de gestão</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <input name="username" placeholder="Sobrenome.Nome" className="w-full p-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-600 font-bold" />
              <input name="password" type="password" placeholder="Sua senha" className="w-full p-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 focus:ring-indigo-600 font-bold" />
              
              <div className="flex items-center gap-2 ml-2 py-2">
                <input 
                  type="checkbox" 
                  id="remember" 
                  checked={rememberMe} 
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="remember" className="text-sm font-bold text-slate-600">Lembrar de mim</label>
              </div>

              <button className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95">ENTRAR</button>
            </form>
            <p className="mt-8 text-center text-sm text-slate-400">Ainda não tem conta? <button onClick={() => setView('signup')} className="text-indigo-600 font-black">Cadastre-se aqui</button></p>
          </div>
        )}

        {view === 'signup' && (
          <div className="max-w-md mx-auto mt-10 bg-white p-10 rounded-[2.5rem] shadow-2xl">
            <h2 className="text-2xl font-black text-center mb-2">Novo Cadastro</h2>
            <p className="text-center text-slate-400 text-xs mb-8">Pode ser feito em qualquer dia ou horário</p>
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input required name="firstName" placeholder="Nome" className="p-4 rounded-2xl bg-slate-50 border-none font-bold" />
                <input required name="lastName" placeholder="Sobrenome" className="p-4 rounded-2xl bg-slate-50 border-none font-bold" />
              </div>
              <input required name="congregation" placeholder="Congregação" className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" />
              <input required name="password" type="password" placeholder="Crie uma senha" className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" />
              <button className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg mt-4 hover:bg-indigo-700 transition-all">FINALIZAR CADASTRO</button>
            </form>
            <button onClick={() => setView('login')} className="w-full mt-4 text-slate-300 font-bold text-xs uppercase tracking-widest">Voltar</button>
          </div>
        )}

        {view === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* Seletor de Horários */}
            <div className="flex bg-white p-2 rounded-3xl shadow-sm border border-slate-100 gap-2">
              <button onClick={() => setActiveTab('19h')} className={`flex-1 py-4 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 ${activeTab === '19h' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>
                <Clock size={16}/> 19:00 - QUADRA 3
              </button>
              <button onClick={() => setActiveTab('21h')} className={`flex-1 py-4 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2 ${activeTab === '21h' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400 hover:bg-slate-50'}`}>
                <Clock size={16}/> 21:00 - QUADRA 2
              </button>
            </div>

            {currentAccess.canSee ? (
              <div className="space-y-6">
                <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col md:flex-row gap-6 items-center">
                  <div className="flex-1">
                    <h3 className="text-xl font-black text-slate-800">Lista das {activeTab}</h3>
                    <p className="text-xs text-slate-400 font-bold mt-1">Jogadores confirmados: <span className="text-indigo-600 font-black">{currentList.players.length} / 24</span></p>
                  </div>
                  <button 
                    onClick={() => handleJoinGame(activeTab)}
                    disabled={currentList.players.some(p => p.uid === user.uid) || currentList.players.length >= 24}
                    className={`w-full md:w-auto px-10 py-4 rounded-2xl font-black transition-all shadow-xl ${currentList.players.some(p => p.uid === user.uid) ? 'bg-slate-100 text-slate-400' : 'bg-green-600 text-white hover:bg-green-700 active:scale-95 shadow-green-100'}`}
                  >
                    {currentList.players.some(p => p.uid === user.uid) ? 'VOCÊ ESTÁ NA LISTA' : 'MARCAR MEU NOME'}
                  </button>
                </div>

                <div ref={listRef} className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden">
                  <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white">
                    <div>
                      <h2 className="text-3xl font-black text-indigo-900 leading-none tracking-tighter uppercase">Vôlei {activeTab}</h2>
                      <p className="text-[10px] text-slate-400 font-bold mt-2 font-mono uppercase">DATA: {new Date().toLocaleDateString()} | {new Date().toLocaleTimeString()}</p>
                    </div>
                    {(userData.isAdmin || userData.isMaster) && (
                      <div className="flex gap-2">
                        <button onClick={() => resetList(activeTab)} className="p-3 bg-red-50 text-red-600 rounded-2xl hover:bg-red-100 transition-all"><Trash2 size={18}/></button>
                        <button onClick={downloadJPG} className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-6 py-3 rounded-2xl text-xs font-black hover:bg-indigo-100 transition-all shadow-sm">
                          <Download size={18}/> JPG
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50/30">
                    {[...Array(24)].map((_, i) => {
                      const p = currentList.players[i];
                      return (
                        <div key={i} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${p ? 'bg-white border-indigo-200 ring-1 ring-indigo-50 shadow-sm' : 'bg-slate-50/50 border-dashed border-slate-200'}`}>
                          <div className="flex items-center gap-4 overflow-hidden">
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ${p ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-200 text-slate-400'}`}>{i+1}</span>
                            <div className="truncate">
                              <p className={`font-black text-sm uppercase tracking-tight ${p ? 'text-slate-800' : 'text-slate-300 italic'}`}>{p ? p.name : 'Disponível'}</p>
                              {p && <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest">{p.congregation}</p>}
                            </div>
                          </div>
                          {p && (userData.isAdmin || userData.isMaster || p.uid === user.uid) && (
                            <button onClick={() => handleRemovePlayer(activeTab, p.uid)} className="p-2 text-red-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><LogOut size={18}/></button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="bg-indigo-900 p-6 text-center text-white">
                      <p className="text-[10px] font-black opacity-50 uppercase tracking-[0.3em] mb-1">Local do Jogo</p>
                      <p className="font-bold text-sm">{activeTab === '19h' ? 'QUADRA 3 - 19:00 (SEXTA)' : 'QUADRA 2 - 21:00 (SEXTA)'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white p-16 rounded-[3rem] shadow-xl border border-slate-100 text-center space-y-6 animate-in zoom-in-95 duration-500">
                <div className="w-24 h-24 bg-slate-100 rounded-[2rem] flex items-center justify-center mx-auto text-slate-300"><Lock size={48}/></div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight">Acesso Temporário Restrito</h3>
                  <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto font-medium">{currentAccess.reason}</p>
                </div>
                {(!userData.isMonthly19 && !userData.isMonthly21) && (
                  <div className="bg-amber-50 text-amber-700 p-4 rounded-2xl inline-block text-xs font-black uppercase tracking-wider">
                    Status: Usuário Avulso
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {view === 'profile' && (
          <div className="max-w-md mx-auto mt-6 bg-white p-10 rounded-[2.5rem] shadow-2xl animate-in slide-in-from-bottom-8 duration-500">
            <div className="text-center mb-8">
               <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600 shadow-inner">
                  <UserCircle size={48}/>
               </div>
               <h2 className="text-2xl font-black text-slate-800">Meu Perfil</h2>
               <p className="text-slate-400 text-xs mt-1 uppercase font-bold tracking-widest">Editar Cadastro</p>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-5">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Nome</label>
                <input required name="firstName" defaultValue={userData.firstName} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold outline-none focus:ring-2 focus:ring-indigo-600" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Sobrenome</label>
                <input required name="lastName" defaultValue={userData.lastName} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold outline-none focus:ring-2 focus:ring-indigo-600" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Congregação</label>
                <input required name="congregation" defaultValue={userData.congregation} className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold outline-none focus:ring-2 focus:ring-indigo-600" />
              </div>
              
              <div className="pt-4 space-y-3">
                <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all">
                  <Save size={20}/> SALVAR ALTERAÇÕES
                </button>
                
                <button type="button" onClick={handleInstallApp} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black shadow-lg flex items-center justify-center gap-2 hover:bg-slate-800 transition-all">
                  <Smartphone size={20}/> INSTALAR COMO APP
                </button>
              </div>
            </form>
          </div>
        )}

        {view === 'admin' && (userData.isAdmin || userData.isMaster) && (
          <div className="space-y-6 animate-in slide-in-from-right-4 duration-500">
            <div className="flex justify-between items-end">
              <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3 italic"><Users size={32} className="text-indigo-600"/> Membros</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{allUsers.length} Cadastros</p>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-slate-100">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100">
                    <tr>
                      <th className="p-5">Nome do Membro</th>
                      <th className="p-5 text-center">Mensal 19h</th>
                      <th className="p-5 text-center">Mensal 21h</th>
                      <th className="p-5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {allUsers.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50/50 transition-all group">
                        <td className="p-5">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${u.isMaster ? 'bg-amber-100 text-amber-600' : u.isAdmin ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                               {u.isMaster ? <Crown size={20}/> : <Users size={20}/>}
                            </div>
                            <div>
                               <p className="font-black text-slate-800 text-sm uppercase leading-none mb-1">{u.username}</p>
                               <p className="text-[10px] text-slate-400 font-bold">{u.congregation}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-5 text-center">
                          <button onClick={() => toggleUserField(u.id, 'isMonthly19', u.isMonthly19)} className={`p-3 rounded-2xl transition-all shadow-sm ${u.isMonthly19 ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-300 hover:bg-slate-200'}`}><CheckCircle2 size={20}/></button>
                        </td>
                        <td className="p-5 text-center">
                          <button onClick={() => toggleUserField(u.id, 'isMonthly21', u.isMonthly21)} className={`p-3 rounded-2xl transition-all shadow-sm ${u.isMonthly21 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-300 hover:bg-slate-200'}`}><CheckCircle2 size={20}/></button>
                        </td>
                        <td className="p-5 text-right">
                          {userData.isMaster && !u.isMaster && (
                            <button onClick={() => toggleUserField(u.id, 'isAdmin', u.isAdmin)} className={`px-4 py-2 rounded-xl text-[9px] font-black shadow-sm transition-all ${u.isAdmin ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-indigo-50 text-indigo-600 border border-indigo-100'}`}>
                              {u.isAdmin ? 'REMOVER ADM' : 'TORNAR ADM'}
                            </button>
                          )}
                          {u.isMaster && <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest italic pr-2">MASTER</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {view === 'finance' && (userData.isAdmin || userData.isMaster) && (
          <div className="space-y-6 animate-in slide-in-from-left-4 duration-500">
            <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3 italic"><DollarSign size={32} className="text-green-600"/> Financeiro</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <div className="md:col-span-2 bg-indigo-900 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden flex flex-col justify-center min-h-[200px]">
                  <p className="text-indigo-300 text-[10px] font-black uppercase tracking-[0.3em] mb-2">Dinheiro em Caixa</p>
                  <p className="text-6xl font-black tracking-tighter">R$ {(finances.totalCash || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  <div className="absolute -right-12 -bottom-12 opacity-10 rotate-12"><DollarSign size={240}/></div>
               </div>
               <div className="bg-white p-8 rounded-[3rem] shadow-xl border border-slate-100 flex flex-col justify-center text-center">
                  <p className="text-slate-400 text-[10px] font-black uppercase mb-2">Total Lançamentos</p>
                  <p className="text-4xl font-black text-slate-800">{finances.history?.length || 0}</p>
                  <History className="mx-auto mt-4 text-indigo-100" size={32}/>
               </div>
            </div>

            <div className="bg-white p-10 rounded-[3rem] shadow-xl border border-slate-100">
              <h3 className="font-black text-slate-800 uppercase text-xs tracking-widest mb-6">Novo Lançamento</h3>
              <form onSubmit={addFinance} className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full space-y-2">
                   <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Valor (R$)</label>
                   <input required name="amount" type="number" step="0.01" placeholder="Ex: 20.00" className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-lg" />
                </div>
                <div className="flex-[2] w-full space-y-2">
                   <label className="text-[10px] font-black text-slate-400 ml-2 uppercase">Descrição</label>
                   <input required name="desc" placeholder="Ex: Mensalidade João Silva" className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold text-lg" />
                </div>
                <button className="w-full md:w-auto bg-green-600 text-white px-10 py-4 rounded-2xl font-black shadow-lg shadow-green-100 hover:bg-green-700 transition-all active:scale-95">SALVAR</button>
              </form>
            </div>

            <div className="bg-white rounded-[3rem] shadow-xl border border-slate-100 overflow-hidden">
              <h3 className="p-8 font-black text-slate-800 border-b border-slate-50 uppercase text-xs tracking-widest bg-slate-50/50">Histórico de Movimentações</h3>
              <div className="max-h-[400px] overflow-y-auto">
                {finances.history?.slice().reverse().map((r, i) => (
                  <div key={i} className="flex justify-between items-center p-6 border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-all">
                    <div className="flex items-center gap-5">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${r.amount >= 0 ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                         {r.amount >= 0 ? <PlusCircle size={20}/> : <UserMinus size={18}/>}
                      </div>
                      <div>
                        <p className="font-black text-slate-800 text-sm uppercase leading-tight">{r.desc}</p>
                        <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase">POR {r.admin} • {new Date(r.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <p className={`text-xl font-black ${r.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {r.amount >= 0 ? '+' : ''} R$ {Math.abs(r.amount).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Navegação Inferior Fixa */}
      {userData && (
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-2xl border border-white p-2 rounded-[2.5rem] shadow-2xl z-[60] w-[94%] max-w-lg ring-1 ring-slate-200/50 flex gap-2">
          <button onClick={() => setView('dashboard')} className={`flex-1 flex flex-col items-center py-4 rounded-3xl transition-all ${view === 'dashboard' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400 hover:text-indigo-400'}`}>
            <Calendar size={22} /><span className="text-[9px] font-black uppercase mt-1 tracking-widest">Jogo</span>
          </button>
          
          <button onClick={() => setView('profile')} className={`flex-1 flex flex-col items-center py-4 rounded-3xl transition-all ${view === 'profile' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400 hover:text-indigo-400'}`}>
            <UserCircle size={22} /><span className="text-[9px] font-black uppercase mt-1 tracking-widest">Perfil</span>
          </button>

          {(userData.isAdmin || userData.isMaster) && (
            <>
              <button onClick={() => setView('admin')} className={`flex-1 flex flex-col items-center py-4 rounded-3xl transition-all ${view === 'admin' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400 hover:text-indigo-400'}`}>
                <Users size={22} /><span className="text-[9px] font-black uppercase mt-1 tracking-widest">Sócios</span>
              </button>
              <button onClick={() => setView('finance')} className={`flex-1 flex flex-col items-center py-4 rounded-3xl transition-all ${view === 'finance' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400 hover:text-indigo-400'}`}>
                <DollarSign size={22} /><span className="text-[9px] font-black uppercase mt-1 tracking-widest">Caixa</span>
              </button>
            </>
          )}
        </nav>
      )}
    </div>
  );
}