import React, { useState, useEffect, useRef } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, doc, setDoc, getDoc, collection, onSnapshot, 
  updateDoc, arrayUnion, arrayRemove, runTransaction 
} from 'firebase/firestore';
import { 
  Users, Calendar, Clock, ShieldCheck, LogOut, PlusCircle, 
  CheckCircle2, AlertCircle, UserCircle, Users2, Lock 
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

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'voley-manager-v4'; 

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
    const userDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', uid));
    if (userDoc.exists()) {
      setUserData(userDoc.data());
      setView('dashboard');
    } else {
      setView('login');
    }
    setLoading(false);
  };

  // --- LÓGICA DE ACESSO ---
  const checkAccess = (court) => {
    const game = court === '19h' ? gameData19 : gameData21;
    if (userData?.isMaster || userData?.isAdmin) return { canJoin: true, status: game.status };
    
    if (game.status === 'closed') return { canJoin: false, status: 'closed' };
    if (game.status === 'monthly') {
        const isMonthly = court === '19h' ? userData?.isMonthly19 : userData?.isMonthly21;
        return { canJoin: !!isMonthly, status: 'monthly' };
    }
    return { canJoin: true, status: 'open' };
  };

  const handleJoinGame = async (court, targetUser = null) => {
    const playerToAdd = targetUser || userData;
    const access = checkAccess(court);

    if (!access.canJoin) {
        return showMessage("Você não tem permissão para entrar nesta lista agora.", "error");
    }

    try {
      await runTransaction(db, async (transaction) => {
        const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', court);
        const gameDoc = await transaction.get(gameRef);
        let players = gameDoc.exists() ? gameDoc.data().players : [];

        if (players.length >= 24) throw new Error("Lista cheia!");
        if (players.some(p => p.uid === (playerToAdd.id || playerToAdd.uid))) {
            throw new Error(`${playerToAdd.username} já está na lista!`);
        }

        const newPlayer = {
          uid: playerToAdd.id || playerToAdd.uid,
          name: playerToAdd.username,
          congregation: playerToAdd.congregation,
          time: new Date().toISOString()
        };

        transaction.update(gameRef, { players: [...players, newPlayer] });
      });
      showMessage(`${playerToAdd.username} confirmado!`, "success");
    } catch (e) { showMessage(e.message, 'error'); }
  };

  const setGameStatus = async (court, status) => {
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', court), { status }, { merge: true });
    showMessage(`Status alterado para ${status.toUpperCase()}`, "success");
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const found = allUsers.find(u => u.username === e.target.username.value && u.password === e.target.password.value);
    if (found) { setUserData(found); setView('dashboard'); }
    else showMessage("Usuário ou senha incorretos", "error");
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const info = {
      id: user.uid,
      firstName: f.get('firstName'),
      lastName: f.get('lastName'),
      congregation: f.get('congregation'),
      password: f.get('password'),
      username: `${f.get('lastName')}.${f.get('firstName')}`,
      isMonthly19: false,
      isMonthly21: false,
      isAdmin: allUsers.length === 0,
      isMaster: allUsers.length === 0,
      familyIds: []
    };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), info);
    setUserData(info);
    setView('dashboard');
  };

  const associateFamily = async (userId, familyMemberId) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', userId), { familyIds: arrayUnion(familyMemberId) });
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', familyMemberId), { familyIds: arrayUnion(userId) });
    showMessage("Família vinculada!", "success");
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  if (loading) return <div className="h-screen bg-indigo-900 flex items-center justify-center text-white font-black animate-pulse">VÔLEI ELITE...</div>;

  const currentList = activeTab === '19h' ? gameData19 : gameData21;
  const familyMembers = allUsers.filter(u => userData?.familyIds?.includes(u.id));

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-32">
      {message && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 ${message.type === 'error' ? 'bg-red-600' : 'bg-green-600'} text-white font-bold animate-in fade-in slide-in-from-top-4`}>
          {message.text}
        </div>
      )}

      {userData && (
        <header className="bg-indigo-800 text-white p-4 shadow-xl sticky top-0 z-50 flex justify-between items-center">
          <h1 className="font-black text-xl italic uppercase tracking-tighter">VÔLEI ELITE</h1>
          <button onClick={() => {setUserData(null); setView('login')}} className="p-2 bg-white/10 rounded-xl"><LogOut size={20}/></button>
        </header>
      )}

      <main className="max-w-4xl mx-auto p-4">
        {view === 'login' && (
          <div className="max-w-md mx-auto mt-16 bg-white p-10 rounded-[2.5rem] shadow-2xl">
            <h2 className="text-3xl font-black text-center mb-8 uppercase italic">Login</h2>
            <form onSubmit={handleLogin} className="space-y-4">
              <input name="username" placeholder="Sobrenome.Nome" className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" />
              <input name="password" type="password" placeholder="Senha" className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" />
              <button className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg">ENTRAR</button>
            </form>
            <button onClick={() => setView('signup')} className="w-full mt-6 text-indigo-600 font-black">Criar nova conta</button>
          </div>
        )}

        {view === 'signup' && (
          <div className="max-w-md mx-auto mt-10 bg-white p-10 rounded-[2.5rem] shadow-2xl">
            <h2 className="text-2xl font-black text-center mb-6 uppercase italic">Cadastro</h2>
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input required name="firstName" placeholder="Nome" className="p-4 rounded-2xl bg-slate-50 border-none font-bold" />
                <input required name="lastName" placeholder="Sobrenome" className="p-4 rounded-2xl bg-slate-50 border-none font-bold" />
              </div>
              <input required name="congregation" placeholder="Congregação" className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" />
              <input required name="password" type="password" placeholder="Senha" className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" />
              <button className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg">FINALIZAR</button>
            </form>
          </div>
        )}

        {view === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex bg-white p-2 rounded-3xl shadow-sm border border-slate-100 gap-2">
                <button onClick={() => setActiveTab('19h')} className={`flex-1 py-4 rounded-2xl font-black text-xs transition-all ${activeTab === '19h' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400'}`}>19:00 - QUADRA 3</button>
                <button onClick={() => setActiveTab('21h')} className={`flex-1 py-4 rounded-2xl font-black text-xs transition-all ${activeTab === '21h' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400'}`}>21:00 - QUADRA 2</button>
            </div>

            {(userData.isAdmin || userData.isMaster) && (
                <div className="bg-white p-4 rounded-3xl shadow-md border border-indigo-100 flex flex-wrap gap-2 justify-center">
                    <button onClick={() => setGameStatus(activeTab, 'closed')} className={`px-4 py-2 rounded-xl text-[10px] font-black border ${currentList.status === 'closed' ? 'bg-red-600 text-white' : 'text-red-600'}`}>FECHAR</button>
                    <button onClick={() => setGameStatus(activeTab, 'monthly')} className={`px-4 py-2 rounded-xl text-[10px] font-black border ${currentList.status === 'monthly' ? 'bg-amber-500 text-white' : 'text-amber-500'}`}>MENSAL</button>
                    <button onClick={() => setGameStatus(activeTab, 'open')} className={`px-4 py-2 rounded-xl text-[10px] font-black border ${currentList.status === 'open' ? 'bg-green-600 text-white' : 'text-green-600'}`}>AVULSO</button>
                </div>
            )}

            <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-black text-slate-800 uppercase text-xs">Ações</h3>
                    <div className="px-3 py-1 rounded-full text-[10px] font-black uppercase bg-slate-100">
                        {currentList.status}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button onClick={() => handleJoinGame(activeTab)} className="py-4 bg-indigo-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg">
                        <PlusCircle size={18}/> MEU NOME
                    </button>
                    {familyMembers.map(member => (
                        <button key={member.id} onClick={() => handleJoinGame(activeTab, member)} className="py-4 bg-slate-100 text-slate-700 rounded-2xl font-black flex items-center justify-center gap-2">
                            <Users2 size={18}/> + {member.username}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden">
                <div className="p-8 border-b flex justify-between items-center">
                    <h2 className="text-xl font-black text-indigo-900 uppercase">Lista {activeTab}</h2>
                    <p className="font-black text-indigo-600">{currentList.players?.length || 0}/24</p>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50/30">
                    {[...Array(24)].map((_, i) => {
                        const p = currentList.players?.[i];
                        return (
                            <div key={i} className={`flex items-center justify-between p-4 rounded-2xl border ${p ? 'bg-white border-indigo-100' : 'bg-slate-50 border-dashed'}`}>
                                <div className="flex items-center gap-4">
                                    <span className="text-[10px] font-black opacity-30">{i+1}</span>
                                    <p className="font-black text-sm uppercase">{p ? p.name : 'Vaga Livre'}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
          </div>
        )}

        {view === 'admin' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-black uppercase italic">Membros</h2>
            <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden">
                {allUsers.map(u => (
                    <div key={u.id} className="p-5 border-b flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <span className="font-black text-sm uppercase">{u.username}</span>
                            <button onClick={() => associateFamily(userData.id, u.id)} className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg uppercase">Vincular Família</button>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', u.id), { isMonthly19: !u.isMonthly19 })} className={`flex-1 py-2 rounded-lg text-[9px] font-black border ${u.isMonthly19 ? 'bg-green-600 text-white' : 'text-slate-400'}`}>MENSAL 19H</button>
                             <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', u.id), { isMonthly21: !u.isMonthly21 })} className={`flex-1 py-2 rounded-lg text-[9px] font-black border ${u.isMonthly21 ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>MENSAL 21H</button>
                        </div>
                    </div>
                ))}
            </div>
          </div>
        )}
      </main>

      {userData && (
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-2xl border p-2 rounded-[2.5rem] shadow-2xl z-[60] w-[90%] max-w-sm flex gap-2">
          <button onClick={() => setView('dashboard')} className={`flex-1 flex flex-col items-center py-4 rounded-3xl ${view === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>
            <Calendar size={20} /><span className="text-[8px] font-black mt-1">JOGO</span>
          </button>
          {(userData.isAdmin || userData.isMaster) && (
            <button onClick={() => setView('admin')} className={`flex-1 flex flex-col items-center py-4 rounded-3xl ${view === 'admin' ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>
              <Users size={20} /><span className="text-[8px] font-black mt-1">SÓCIOS</span>
            </button>
          )}
        </nav>
      )}
    </div>
  );
}