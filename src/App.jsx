import React, { useState, useEffect, useRef } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, doc, setDoc, getDoc, collection, onSnapshot, 
  updateDoc, arrayUnion, arrayRemove, runTransaction 
} from 'firebase/firestore';
import { 
  Users, Calendar, Clock, ShieldCheck, LogOut, PlusCircle, 
  CheckCircle2, AlertCircle, UserCircle, Users2, Lock, Unlock, Trash2
} from 'lucide-react';

// --- CONFIGURAÇÃO FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAQXrADQKC7ZI2EPYsBl2cKz-hFJkPVOEA",
  authDomain: "voley-app-c3ee1.firebaseapp.com",
  projectId: "voley-app-c3ee1",
  storageBucket: "voley-app-c3ee1.firebasestorage.app",
  messagingSenderId: "693100331235",
  appId: "1:693100331235:web:ce1e921c8004c24884c5d6",
};

// Inicialização segura
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

// AJUSTE CRUCIAL: Voltamos para v3 conforme visto no seu print do Firestore
const appId = 'voley-manager-v3'; 

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('login'); 
  const [activeTab, setActiveTab] = useState('19h'); 
  const [gameData19, setGameData19] = useState({ players: [], status: 'closed' });
  const [gameData21, setGameData21] = useState({ players: [], status: 'closed' });
  const [allUsers, setAllUsers] = useState([]);
  const [message, setMessage] = useState(null);
  
  const listRef = useRef(null);

  // Autenticação Inicial
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Erro Auth:", err);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) fetchUserData(u.uid);
      else setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Escuta em tempo real do Banco de Dados
  useEffect(() => {
    if (!user || !db) return;
    
    // Agora o app vai ler da coleção correta (v3)
    const unsub19 = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'games', '19h'), (d) => {
      setGameData19(d.exists() ? d.data() : { players: [], status: 'closed' });
    });
    
    const unsub21 = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'games', '21h'), (d) => {
      setGameData21(d.exists() ? d.data() : { players: [], status: 'closed' });
    });
    
    const unsubUsers = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'users'), (s) => {
      setAllUsers(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    return () => { unsub19(); unsub21(); unsubUsers(); };
  }, [user]);

  const fetchUserData = async (uid) => {
    try {
      const userDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', uid));
      if (userDoc.exists()) {
        setUserData(userDoc.data());
        setView('dashboard');
      } else {
        setView('login');
      }
    } catch (e) {
      console.error("Erro ao buscar dados:", e);
    }
    setLoading(false);
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  // --- LÓGICA DE ACESSO ---
  const getAccess = (court) => {
    const game = court === '19h' ? gameData19 : gameData21;
    const status = game?.status || 'closed';
    
    if (userData?.isMaster || userData?.isAdmin) return { canJoin: true, status };
    if (status === 'closed') return { canJoin: false, status };
    
    if (status === 'monthly') {
      const isMonthly = court === '19h' ? userData?.isMonthly19 : userData?.isMonthly21;
      return { canJoin: !!isMonthly, status };
    }
    
    return { canJoin: true, status };
  };

  const handleJoinGame = async (court, targetUser = null) => {
    const playerToAdd = targetUser || userData;
    const access = getAccess(court);

    if (!access.canJoin) {
      return showMessage("Lista fechada ou restrita para mensalistas.", "error");
    }

    try {
      await runTransaction(db, async (transaction) => {
        const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', court);
        const gameDoc = await transaction.get(gameRef);
        let players = gameDoc.exists() ? gameDoc.data().players : [];

        if (players.length >= 24) throw new Error("Lista cheia (máx 24)!");
        
        const targetId = playerToAdd.id || playerToAdd.uid;
        if (players.some(p => p.uid === targetId)) {
          throw new Error(`${playerToAdd.username} já está na lista!`);
        }

        const newPlayer = {
          uid: targetId,
          name: playerToAdd.username,
          congregation: playerToAdd.congregation,
          time: new Date().toISOString()
        };

        transaction.set(gameRef, { players: [...players, newPlayer] }, { merge: true });
      });
      showMessage(`${playerToAdd.username} confirmado!`, "success");
    } catch (e) {
      showMessage(e.message, "error");
    }
  };

  const handleRemovePlayer = async (court, playerUid) => {
    const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', court);
    const game = court === '19h' ? gameData19 : gameData21;
    const player = game.players.find(p => p.uid === playerUid);
    if (player) {
      await updateDoc(gameRef, { players: arrayRemove(player) });
      showMessage("Nome removido.", "info");
    }
  };

  const setGameStatus = async (court, status) => {
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', court), { status }, { merge: true });
    showMessage(`Lista ${court} agora: ${status.toUpperCase()}`, "success");
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const uIn = e.target.username.value;
    const pIn = e.target.password.value;
    
    // Comparação exata com os dados do Firestore
    const found = allUsers.find(u => u.username === uIn && u.password === pIn);
    
    if (found) {
      setUserData(found);
      setView('dashboard');
      showMessage("Login realizado!", "success");
    } else {
      showMessage("Utilizador ou senha incorretos.", "error");
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const isFirst = allUsers.length === 0;
    
    const info = {
      id: user.uid,
      firstName: f.get('firstName'),
      lastName: f.get('lastName'),
      congregation: f.get('congregation'),
      password: f.get('password'),
      username: `${f.get('lastName')}.${f.get('firstName')}`,
      isMonthly19: false,
      isMonthly21: false,
      isAdmin: isFirst,
      isMaster: isFirst,
      familyIds: []
    };

    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), info);
      setUserData(info);
      setView('dashboard');
      showMessage("Cadastro realizado!", "success");
    } catch (err) {
      showMessage("Erro ao cadastrar.", "error");
    }
  };

  const associateFamily = async (userId, familyMemberId) => {
    if (userId === familyMemberId) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', userId), { familyIds: arrayUnion(familyMemberId) });
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', familyMemberId), { familyIds: arrayUnion(userId) });
    showMessage("Vínculo familiar criado!", "success");
  };

  if (loading) return (
    <div className="h-screen bg-indigo-900 flex flex-col items-center justify-center text-white font-black">
      <div className="animate-bounce mb-4 text-4xl">🏐</div>
      <p className="animate-pulse tracking-widest uppercase text-xs">Vôlei Elite...</p>
    </div>
  );

  const currentList = activeTab === '19h' ? gameData19 : gameData21;
  const familyMembers = allUsers.filter(u => userData?.familyIds?.includes(u.id));
  const access = getAccess(activeTab);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-32">
      {message && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 ${message.type === 'error' ? 'bg-red-600' : 'bg-green-600'} text-white font-bold animate-in fade-in slide-in-from-top-4`}>
          {message.text}
        </div>
      )}

      {userData && (
        <header className="bg-indigo-800 text-white p-4 shadow-xl sticky top-0 z-50 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Calendar size={20} className="text-indigo-300" />
            <h1 className="font-black text-lg italic uppercase tracking-tighter">VÔLEI ELITE</h1>
          </div>
          <button onClick={() => {setUserData(null); setView('login')}} className="p-2 bg-white/10 rounded-xl"><LogOut size={18}/></button>
        </header>
      )}

      <main className="max-w-4xl mx-auto p-4">
        {view === 'login' && (
          <div className="max-w-md mx-auto mt-12 bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100">
            <div className="text-center mb-8">
              <ShieldCheck size={48} className="mx-auto text-indigo-600 mb-2"/>
              <h2 className="text-3xl font-black uppercase italic tracking-tighter">Login</h2>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <input required name="username" placeholder="Sobrenome.Nome" className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold focus:ring-2 focus:ring-indigo-600 outline-none" />
              <input required name="password" type="password" placeholder="Senha" className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold focus:ring-2 focus:ring-indigo-600 outline-none" />
              <button className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg hover:bg-indigo-700 transition-all">ENTRAR</button>
            </form>
            <button onClick={() => setView('signup')} className="w-full mt-6 text-indigo-600 font-black text-sm uppercase">Criar nova conta</button>
          </div>
        )}

        {view === 'signup' && (
          <div className="max-w-md mx-auto mt-8 bg-white p-10 rounded-[2.5rem] shadow-2xl">
            <h2 className="text-2xl font-black text-center mb-8 uppercase italic">Novo Cadastro</h2>
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input required name="firstName" placeholder="Nome" className="p-4 rounded-2xl bg-slate-50 border-none font-bold" />
                <input required name="lastName" placeholder="Sobrenome" className="p-4 rounded-2xl bg-slate-50 border-none font-bold" />
              </div>
              <input required name="congregation" placeholder="Congregação" className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" />
              <input required name="password" type="password" placeholder="Crie uma senha" className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" />
              <button className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg">FINALIZAR</button>
            </form>
            <button onClick={() => setView('login')} className="w-full mt-4 text-slate-400 font-bold text-xs uppercase">Voltar ao Login</button>
          </div>
        )}

        {view === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* Seletor de Quadras */}
            <div className="flex bg-white p-2 rounded-3xl shadow-sm border border-slate-100 gap-2">
                <button onClick={() => setActiveTab('19h')} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase transition-all ${activeTab === '19h' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400'}`}>19:00 - QUADRA 3</button>
                <button onClick={() => setActiveTab('21h')} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase transition-all ${activeTab === '21h' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400'}`}>21:00 - QUADRA 2</button>
            </div>

            {/* Controles Administrativos */}
            {(userData.isAdmin || userData.isMaster) && (
                <div className="bg-white p-4 rounded-3xl shadow-md border border-indigo-50 flex flex-wrap gap-2 justify-center">
                    <button onClick={() => setGameStatus(activeTab, 'closed')} className={`px-4 py-2 rounded-xl text-[9px] font-black border uppercase ${access.status === 'closed' ? 'bg-red-600 text-white border-red-600' : 'text-red-600 border-red-200'}`}>FECHAR</button>
                    <button onClick={() => setGameStatus(activeTab, 'monthly')} className={`px-4 py-2 rounded-xl text-[9px] font-black border uppercase ${access.status === 'monthly' ? 'bg-amber-500 text-white border-amber-500' : 'text-amber-500 border-amber-200'}`}>MENSAL</button>
                    <button onClick={() => setGameStatus(activeTab, 'open')} className={`px-4 py-2 rounded-xl text-[9px] font-black border uppercase ${access.status === 'open' ? 'bg-green-600 text-white border-green-600' : 'text-green-600 border-green-200'}`}>AVULSO</button>
                </div>
            )}

            {/* Painel de Marcação */}
            <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-black text-slate-800 uppercase text-xs tracking-tighter">Status: {access.status}</h3>
                    <div className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-slate-100 text-slate-500">
                        {currentList.players?.length || 0} / 24 confirmados
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button 
                        onClick={() => handleJoinGame(activeTab)} 
                        className={`py-4 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 ${access.canJoin ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-slate-100 text-slate-300'}`}
                    >
                        <PlusCircle size={18}/> MEU NOME
                    </button>
                    
                    {familyMembers.map(member => (
                        <button 
                            key={member.id} 
                            onClick={() => handleJoinGame(activeTab, member)} 
                            className={`py-4 rounded-2xl font-black flex items-center justify-center gap-2 transition-all active:scale-95 ${access.canJoin ? 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100' : 'bg-slate-50 text-slate-200'}`}
                        >
                            <Users2 size={18}/> + {member.username}
                        </button>
                    ))}
                </div>
                {!access.canJoin && access.status !== 'closed' && (
                    <p className="text-[10px] text-center text-amber-600 font-bold uppercase italic">Aguarde a liberação para Avulsos.</p>
                )}
            </div>

            {/* Lista Visual */}
            <div ref={listRef} className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden">
                <div className="p-8 border-b flex justify-between items-center bg-indigo-50/30">
                    <h2 className="text-xl font-black text-indigo-900 uppercase italic tracking-tighter">Lista confirmada</h2>
                    <div className="flex items-center gap-2">
                        <Clock size={16} className="text-indigo-400"/>
                        <span className="font-black text-indigo-600 text-lg uppercase">{activeTab}</span>
                    </div>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[...Array(24)].map((_, i) => {
                        const p = currentList.players?.[i];
                        return (
                            <div key={i} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${p ? 'bg-white border-indigo-100 shadow-sm' : 'bg-slate-50/50 border-dashed border-slate-200'}`}>
                                <div className="flex items-center gap-4 truncate">
                                    <span className="text-[10px] font-black opacity-20 w-4">{i+1}</span>
                                    <p className={`font-black text-sm uppercase ${p ? 'text-slate-800' : 'text-slate-300'}`}>{p ? p.name : 'Vaga Livre'}</p>
                                </div>
                                {p && (userData.isAdmin || userData.isMaster || p.uid === user.uid) && (
                                    <button onClick={() => handleRemovePlayer(activeTab, p.uid)} className="p-1 text-red-300 hover:text-red-500 transition-colors"><Trash2 size={14}/></button>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
          </div>
        )}

        {view === 'admin' && (userData.isAdmin || userData.isMaster) && (
          <div className="space-y-6">
            <h2 className="text-2xl font-black uppercase italic tracking-tighter">Gerenciar Sócios</h2>
            <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden border border-slate-100">
                {allUsers.filter(u => u.id !== user.uid).map(u => (
                    <div key={u.id} className="p-5 border-b border-slate-50 flex flex-col gap-4 hover:bg-slate-50/50 transition-colors">
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className="font-black text-sm uppercase">{u.username}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase">{u.congregation}</span>
                            </div>
                            <button 
                                onClick={() => associateFamily(userData.id, u.id)} 
                                disabled={userData?.familyIds?.includes(u.id)}
                                className={`text-[9px] font-black px-4 py-2 rounded-xl uppercase transition-all ${userData?.familyIds?.includes(u.id) ? 'bg-green-100 text-green-600' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                            >
                                {userData?.familyIds?.includes(u.id) ? 'Vinculado' : 'Vincular Família'}
                            </button>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', u.id), { isMonthly19: !u.isMonthly19 })} className={`flex-1 py-2 rounded-lg text-[9px] font-black border transition-all ${u.isMonthly19 ? 'bg-green-600 text-white border-green-600' : 'text-slate-300 border-slate-200'}`}>MENSAL 19H</button>
                             <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', u.id), { isMonthly21: !u.isMonthly21 })} className={`flex-1 py-2 rounded-lg text-[9px] font-black border transition-all ${u.isMonthly21 ? 'bg-indigo-600 text-white border-indigo-600' : 'text-slate-300 border-slate-200'}`}>MENSAL 21H</button>
                             <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', u.id), { isAdmin: !u.isAdmin })} className={`px-4 py-2 rounded-lg text-[9px] font-black border ${u.isAdmin ? 'bg-slate-800 text-white border-slate-800' : 'text-slate-300 border-slate-200'}`}>ADM</button>
                        </div>
                    </div>
                ))}
            </div>
          </div>
        )}
      </main>

      {userData && (
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-2xl border border-slate-200 p-2 rounded-[2.5rem] shadow-2xl z-[60] w-[90%] max-w-sm flex gap-2">
          <button onClick={() => setView('dashboard')} className={`flex-1 flex flex-col items-center py-4 rounded-3xl transition-all ${view === 'dashboard' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400'}`}>
            <Calendar size={20} /><span className="text-[8px] font-black mt-1 uppercase">Jogos</span>
          </button>
          {(userData.isAdmin || userData.isMaster) && (
            <button onClick={() => setView('admin')} className={`flex-1 flex flex-col items-center py-4 rounded-3xl transition-all ${view === 'admin' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400'}`}>
              <Users size={20} /><span className="text-[8px] font-black mt-1 uppercase">Sócios</span>
            </button>
          )}
        </nav>
      )}
    </div>
  );
}