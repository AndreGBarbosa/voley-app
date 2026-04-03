import React, { useState, useEffect, useRef } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, doc, setDoc, getDoc, collection, onSnapshot, 
  updateDoc, arrayUnion, arrayRemove, runTransaction 
} from 'firebase/firestore';
import { 
  Users, Calendar, Clock, ShieldCheck, LogOut, PlusCircle, 
  DollarSign, Download, CheckCircle2, AlertCircle, Crown, 
  UserPlus, UserMinus, Lock, Trash2, History, Smartphone, 
  Save, UserCircle, Users2, Unlock 
} from 'lucide-react';

// --- CONFIGURAÇÃO FIREBASE ---
// MANTENHA AS SUAS CHAVES REAIS AQUI
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) fetchUserData(u.uid);
      else setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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
    } else setView('signup');
    setLoading(false);
  };

  // --- LÓGICA DE ACESSO ---
  const canJoin = (court) => {
    const game = court === '19h' ? gameData19 : gameData21;
    if (userData?.isMaster || userData?.isAdmin) return true;
    if (game.status === 'closed') return false;
    if (game.status === 'monthly') {
        return court === '19h' ? userData?.isMonthly19 : userData?.isMonthly21;
    }
    return true; // Status 'open' (avulsos)
  };

  const handleJoinGame = async (court, targetUser = null) => {
    const playerToAdd = targetUser || userData;
    const game = court === '19h' ? gameData19 : gameData21;

    if (!canJoin(court)) {
        return showMessage("Lista fechada ou restrita para este horário.", "error");
    }

    try {
      await runTransaction(db, async (transaction) => {
        const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', court);
        const gameDoc = await transaction.get(gameRef);
        let players = gameDoc.exists() ? gameDoc.data().players : [];

        if (players.length >= 24) throw new Error("Lista cheia!");
        if (players.some(p => p.uid === playerToAdd.id || p.uid === (playerToAdd.uid || playerToAdd.id))) {
            throw new Error(`${playerToAdd.username} já está na lista!`);
        }

        const newPlayer = {
          uid: playerToAdd.id || playerToAdd.uid,
          name: playerToAdd.username,
          congregation: playerToAdd.congregation,
          time: new Date().toISOString()
        };

        transaction.set(gameRef, { players: [...players, newPlayer] }, { merge: true });
      });
      showMessage(`${playerToAdd.username} adicionado!`, "success");
    } catch (e) { showMessage(e.message, 'error'); }
  };

  const setGameStatus = async (court, status) => {
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'games', court), { status });
    showMessage(`Lista das ${court} atualizada para: ${status}`, "info");
  };

  const associateFamily = async (userId, familyMemberId) => {
    if (!userData?.isAdmin && !userData?.isMaster) return;
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', userId), {
      familyIds: arrayUnion(familyMemberId)
    });
    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', familyMemberId), {
      familyIds: arrayUnion(userId)
    });
    showMessage("Vínculo familiar criado!", "success");
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
          <div className="flex items-center gap-2">
            <Calendar size={22} className="text-indigo-300" />
            <h1 className="font-black text-xl italic uppercase tracking-tighter">VÔLEI ELITE</h1>
          </div>
          <button onClick={() => setView('login')} className="p-2 bg-white/10 rounded-xl"><LogOut size={20}/></button>
        </header>
      )}

      <main className="max-w-4xl mx-auto p-4">
        {view === 'dashboard' && (
          <div className="space-y-6">
            {/* Abas e Controles de ADM */}
            <div className="space-y-4">
                <div className="flex bg-white p-2 rounded-3xl shadow-sm border border-slate-100 gap-2">
                    <button onClick={() => setActiveTab('19h')} className={`flex-1 py-4 rounded-2xl font-black text-xs transition-all ${activeTab === '19h' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400'}`}>19:00 - QUADRA 3</button>
                    <button onClick={() => setActiveTab('21h')} className={`flex-1 py-4 rounded-2xl font-black text-xs transition-all ${activeTab === '21h' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400'}`}>21:00 - QUADRA 2</button>
                </div>

                {(userData.isAdmin || userData.isMaster) && (
                    <div className="bg-white p-4 rounded-3xl shadow-md border border-indigo-100 flex flex-wrap gap-2 justify-center">
                        <button onClick={() => setGameStatus(activeTab, 'closed')} className={`px-4 py-2 rounded-xl text-[10px] font-black border ${currentList.status === 'closed' ? 'bg-red-600 text-white border-red-600' : 'text-red-600 border-red-200'}`}>FECHAR LISTA</button>
                        <button onClick={() => setGameStatus(activeTab, 'monthly')} className={`px-4 py-2 rounded-xl text-[10px] font-black border ${currentList.status === 'monthly' ? 'bg-amber-500 text-white border-amber-500' : 'text-amber-500 border-amber-200'}`}>LIBERAR MENSAL</button>
                        <button onClick={() => setGameStatus(activeTab, 'open')} className={`px-4 py-2 rounded-xl text-[10px] font-black border ${currentList.status === 'open' ? 'bg-green-600 text-white border-green-600' : 'text-green-600 border-green-200'}`}>LIBERAR AVULSO</button>
                    </div>
                )}
            </div>

            {/* Seção de Marcação */}
            <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-black text-slate-800 uppercase tracking-widest text-sm">Marcação de Nome</h3>
                    <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${currentList.status === 'closed' ? 'bg-red-100 text-red-600' : currentList.status === 'monthly' ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                        {currentList.status === 'closed' ? 'Lista Fechada' : currentList.status === 'monthly' ? 'Apenas Mensal' : 'Lista Aberta'}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button 
                        onClick={() => handleJoinGame(activeTab)}
                        className="py-4 bg-indigo-600 text-white rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-indigo-700 active:scale-95 transition-all shadow-lg shadow-indigo-100"
                    >
                        <PlusCircle size={18}/> MEU NOME
                    </button>

                    {familyMembers.map(member => (
                        <button 
                            key={member.id}
                            onClick={() => handleJoinGame(activeTab, member)}
                            className="py-4 bg-slate-100 text-slate-700 rounded-2xl font-black flex items-center justify-center gap-2 hover:bg-slate-200 active:scale-95 transition-all"
                        >
                            <Users2 size={18}/> + {member.username}
                        </button>
                    ))}
                </div>
            </div>

            {/* Visualização da Lista */}
            <div ref={listRef} className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden">
                <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                    <h2 className="text-2xl font-black text-indigo-900 uppercase">Lista das {activeTab}</h2>
                    <p className="font-black text-indigo-600 text-xl">{currentList.players?.length || 0}/24</p>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50/30">
                    {[...Array(24)].map((_, i) => {
                        const p = currentList.players?.[i];
                        return (
                            <div key={i} className={`flex items-center justify-between p-4 rounded-2xl border ${p ? 'bg-white border-indigo-100 shadow-sm' : 'bg-slate-50 border-dashed border-slate-200'}`}>
                                <div className="flex items-center gap-4 truncate">
                                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black ${p ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400'}`}>{i+1}</span>
                                    <p className={`font-black text-sm uppercase ${p ? 'text-slate-800' : 'text-slate-300'}`}>{p ? p.name : 'Disponível'}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
          </div>
        )}

        {view === 'admin' && (userData.isAdmin || userData.isMaster) && (
          <div className="space-y-6">
            <h2 className="text-2xl font-black uppercase italic text-slate-800">Gestão de Membros</h2>
            <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden">
                {allUsers.map(u => (
                    <div key={u.id} className="p-5 border-b border-slate-50 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <UserCircle className={u.isAdmin ? "text-indigo-600" : "text-slate-400"} />
                                <span className="font-black text-sm uppercase">{u.username}</span>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => associateFamily(userData.id, u.id)} className="p-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase">Vincular a Mim</button>
                            </div>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', u.id), { isMonthly19: !u.isMonthly19 })} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase border ${u.isMonthly19 ? 'bg-green-600 text-white' : 'text-slate-400'}`}>MENSAL 19h</button>
                             <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', u.id), { isMonthly21: !u.isMonthly21 })} className={`flex-1 py-2 rounded-lg text-[9px] font-black uppercase border ${u.isMonthly21 ? 'bg-indigo-600 text-white' : 'text-slate-400'}`}>MENSAL 21h</button>
                        </div>
                    </div>
                ))}
            </div>
          </div>
        )}

        {/* Signup e Login mantidos conforme versões anteriores... */}
      </main>

      {userData && (
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-2xl border border-white p-2 rounded-[2.5rem] shadow-2xl z-[60] w-[92%] max-w-sm flex gap-2">
          <button onClick={() => setView('dashboard')} className={`flex-1 flex flex-col items-center py-4 rounded-3xl ${view === 'dashboard' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400'}`}>
            <Calendar size={22} /><span className="text-[9px] font-black uppercase mt-1">Jogo</span>
          </button>
          {(userData.isAdmin || userData.isMaster) && (
            <button onClick={() => setView('admin')} className={`flex-1 flex flex-col items-center py-4 rounded-3xl ${view === 'admin' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400'}`}>
              <Users size={22} /><span className="text-[9px] font-black uppercase mt-1 tracking-widest">Sócios</span>
            </button>
          )}
        </nav>
      )}
    </div>
  );
}