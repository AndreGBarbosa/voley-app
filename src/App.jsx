import React, { useState, useEffect, useRef } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { 
  getFirestore, doc, setDoc, getDoc, collection, onSnapshot, 
  updateDoc, arrayUnion, arrayRemove, runTransaction 
} from 'firebase/firestore';
import { 
  Users, Calendar, Clock, ShieldCheck, LogOut, PlusCircle, 
  CheckCircle2, AlertCircle, UserCircle, Users2, Lock, Unlock, 
  Trash2, XCircle, Save, CheckSquare, Square, DollarSign, TrendingUp, Wallet
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
  const [finances, setFinances] = useState({ balance: 0, courtCost19: 0, courtCost21: 0, history: [] });
  const [message, setMessage] = useState(null);
  const [familyModal, setFamilyModal] = useState(null);
  const [selectedFamily, setSelectedFamily] = useState([]);
  
  const listRef = useRef(null);

  useEffect(() => {
    const initAuth = async () => {
      try { await signInAnonymously(auth); } catch (err) { console.error("Erro Auth:", err); }
    };
    initAuth();
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
    const unsubFin = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'finances', 'main'), (d) => {
      if (d.exists()) setFinances(d.data());
    });
    return () => { unsub19(); unsub21(); unsubUsers(); unsubFin(); };
  }, [user]);

  const fetchUserData = async (uid) => {
    try {
      const userDoc = await getDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', uid));
      if (userDoc.exists()) {
        setUserData(userDoc.data());
        setView('dashboard');
      } else setView('login');
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const showMessage = (text, type) => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

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

  // --- LÓGICA DE PAGAMENTO ---
  const togglePlayerPayment = async (court, playerUid) => {
    if (!userData.isAdmin && !userData.isMaster) return;
    try {
      await runTransaction(db, async (transaction) => {
        const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', court);
        const gameDoc = await transaction.get(gameRef);
        if (!gameDoc.exists()) return;
        
        const players = gameDoc.data().players.map(p => {
          if (p.uid === playerUid) return { ...p, paid: !p.paid };
          return p;
        });
        
        transaction.update(gameRef, { players });
      });
      showMessage("Pagamento atualizado!", "success");
    } catch (e) { showMessage("Erro ao atualizar pagamento.", "error"); }
  };

  const updateBalance = async (amount, type = 'add', desc = "") => {
    const newBalance = type === 'add' ? finances.balance + amount : finances.balance - amount;
    const log = { amount, type, desc, date: new Date().toISOString(), admin: userData.username };
    
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'finances', 'main'), {
      balance: newBalance,
      history: arrayUnion(log)
    }, { merge: true });
    showMessage("Saldo atualizado!", "success");
  };

  const updateCourtCost = async (court, value) => {
    const field = court === '19h' ? 'courtCost19' : 'courtCost21';
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'finances', 'main'), {
      [field]: value
    }, { merge: true });
    showMessage("Valor da quadra atualizado!", "success");
  };

  // --- LÓGICA DE MARCAÇÃO ---
  const handleJoinGame = async (court, targetUser = null) => {
    const playerToAdd = targetUser || userData;
    const access = getAccess(court);
    if (!access.canJoin) return showMessage("Lista restrita.", "error");

    try {
      await runTransaction(db, async (transaction) => {
        const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', court);
        const gameDoc = await transaction.get(gameRef);
        let players = gameDoc.exists() ? gameDoc.data().players : [];
        if (players.length >= 24) throw new Error("Lista cheia!");
        const tid = playerToAdd.id || playerToAdd.uid;
        if (players.some(p => p.uid === tid)) throw new Error(`${playerToAdd.username} já está na lista!`);
        
        const newPlayer = {
          uid: tid,
          name: playerToAdd.username,
          congregation: playerToAdd.congregation,
          time: new Date().toISOString(),
          paid: false // Inicia sempre como não pago
        };
        transaction.set(gameRef, { players: [...players, newPlayer] }, { merge: true });
      });
      showMessage(`${playerToAdd.username} confirmado!`, "success");
    } catch (e) { showMessage(e.message, "error"); }
  };

  const handleJoinFamily = async (court) => {
    const access = getAccess(court);
    if (!access.canJoin) return showMessage("Lista restrita.", "error");
    const familyToInclude = [userData, ...allUsers.filter(u => userData.familyIds?.includes(u.id))];
    try {
      await runTransaction(db, async (transaction) => {
        const gameRef = doc(db, 'artifacts', appId, 'public', 'data', 'games', court);
        const gameDoc = await transaction.get(gameRef);
        let players = gameDoc.exists() ? gameDoc.data().players : [];
        familyToInclude.forEach(member => {
          if (players.length < 24 && !players.some(p => p.uid === member.id)) {
            players.push({ uid: member.id, name: member.username, congregation: member.congregation, time: new Date().toISOString(), paid: false });
          }
        });
        transaction.set(gameRef, { players }, { merge: true });
      });
      showMessage("Família incluída!", "success");
    } catch (e) { showMessage(e.message, "error"); }
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

  // --- GESTÃO DE FAMÍLIA ---
  const openFamilySelection = (targetUser) => { setFamilyModal(targetUser); setSelectedFamily(targetUser.familyIds || []); };
  const toggleFamilySelection = (id) => { setSelectedFamily(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]); };
  const saveFamilyLinks = async () => {
    if (!familyModal) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', familyModal.id), { familyIds: selectedFamily });
      for (const memberId of selectedFamily) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', memberId), { familyIds: arrayUnion(familyModal.id) });
      }
      showMessage("Família vinculada!", "success");
      setFamilyModal(null);
    } catch (e) { showMessage("Erro ao salvar.", "error"); }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const found = allUsers.find(u => u.username === e.target.username.value && u.password === e.target.password.value);
    if (found) { setUserData(found); setView('dashboard'); }
    else showMessage("Dados incorretos.", "error");
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const isFirst = allUsers.length === 0;
    const info = {
      id: user.uid, firstName: f.get('firstName'), lastName: f.get('lastName'), congregation: f.get('congregation'),
      password: f.get('password'), username: `${f.get('lastName')}.${f.get('firstName')}`,
      isMonthly19: false, isMonthly21: false, isAdmin: isFirst, isMaster: isFirst, familyIds: [], paidMonth: false
    };
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', user.uid), info);
    setUserData(info); setView('dashboard');
  };

  if (loading) return <div className="h-screen bg-indigo-900 flex items-center justify-center text-white font-black animate-pulse uppercase">Vôlei Elite...</div>;

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

      {familyModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div className="p-6 bg-indigo-600 text-white flex justify-between items-center">
              <h3 className="font-black uppercase text-sm">Vincular Família: {familyModal.username}</h3>
              <button onClick={() => setFamilyModal(null)}><XCircle size={24}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
              {allUsers.filter(u => u.id !== familyModal.id).map(u => (
                <div key={u.id} onClick={() => toggleFamilySelection(u.id)} className={`flex items-center justify-between p-4 rounded-2xl cursor-pointer border-2 transition-all ${selectedFamily.includes(u.id) ? 'bg-indigo-50 border-indigo-600' : 'bg-white border-transparent'}`}>
                  <div className="flex items-center gap-3">
                    {selectedFamily.includes(u.id) ? <CheckSquare className="text-indigo-600" /> : <Square className="text-slate-300" />}
                    <span className="font-black text-xs uppercase">{u.username}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 bg-white border-t"><button onClick={saveFamilyLinks} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl">SALVAR VÍNCULOS</button></div>
          </div>
        </div>
      )}

      {userData && (
        <header className="bg-indigo-800 text-white p-4 shadow-xl sticky top-0 z-50 flex justify-between items-center">
          <h1 className="font-black text-lg italic uppercase tracking-tighter">VÔLEI ELITE</h1>
          <button onClick={() => {setUserData(null); setView('login')}} className="p-2 bg-white/10 rounded-xl"><LogOut size={18}/></button>
        </header>
      )}

      <main className="max-w-4xl mx-auto p-4">
        {view === 'login' && (
          <div className="max-w-md mx-auto mt-12 bg-white p-10 rounded-[2.5rem] shadow-2xl border border-slate-100">
            <h2 className="text-3xl font-black text-center mb-8 uppercase italic">Login</h2>
            <form onSubmit={handleLogin} className="space-y-4">
              <input required name="username" placeholder="Sobrenome.Nome" className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold outline-none" />
              <input required name="password" type="password" placeholder="Senha" className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold outline-none" />
              <button className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg">ENTRAR</button>
            </form>
            <button onClick={() => setView('signup')} className="w-full mt-6 text-indigo-600 font-black text-sm uppercase italic">Não tem conta? Cadastre-se</button>
          </div>
        )}

        {view === 'signup' && (
          <div className="max-w-md mx-auto mt-8 bg-white p-10 rounded-[2.5rem] shadow-2xl">
            <h2 className="text-2xl font-black text-center mb-8 uppercase italic">Criar Conta</h2>
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input required name="firstName" placeholder="Nome" className="p-4 rounded-2xl bg-slate-50 border-none font-bold" />
                <input required name="lastName" placeholder="Sobrenome" className="p-4 rounded-2xl bg-slate-50 border-none font-bold" />
              </div>
              <input required name="congregation" placeholder="Congregação" className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" />
              <input required name="password" type="password" placeholder="Senha" className="w-full p-4 rounded-2xl bg-slate-50 border-none font-bold" />
              <button className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black shadow-lg">CADASTRAR</button>
            </form>
          </div>
        )}

        {view === 'dashboard' && (
          <div className="space-y-6">
            <div className="flex bg-white p-2 rounded-3xl shadow-sm border border-slate-100 gap-2">
                <button onClick={() => setActiveTab('19h')} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase transition-all ${activeTab === '19h' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400'}`}>19:00 - QUADRA 3</button>
                <button onClick={() => setActiveTab('21h')} className={`flex-1 py-4 rounded-2xl font-black text-[10px] uppercase transition-all ${activeTab === '21h' ? 'bg-indigo-600 text-white shadow-xl' : 'text-slate-400'}`}>21:00 - QUADRA 2</button>
            </div>

            {(userData.isAdmin || userData.isMaster) && (
                <div className="bg-white p-4 rounded-3xl shadow-md border border-indigo-50 flex flex-wrap gap-2 justify-center">
                    <button onClick={() => setGameStatus(activeTab, 'closed')} className={`px-4 py-2 rounded-xl text-[9px] font-black border uppercase ${access.status === 'closed' ? 'bg-red-600 text-white' : 'text-red-600'}`}>FECHAR</button>
                    <button onClick={() => setGameStatus(activeTab, 'monthly')} className={`px-4 py-2 rounded-xl text-[9px] font-black border uppercase ${access.status === 'monthly' ? 'bg-amber-500 text-white' : 'text-amber-500'}`}>MENSAL</button>
                    <button onClick={() => setGameStatus(activeTab, 'open')} className={`px-4 py-2 rounded-xl text-[9px] font-black border uppercase ${access.status === 'open' ? 'bg-green-600 text-white' : 'text-green-600'}`}>AVULSO</button>
                </div>
            )}

            <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-100 space-y-4">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="font-black text-slate-800 uppercase text-xs italic tracking-tighter">Marcar Presença</h3>
                    <div className="px-3 py-1 rounded-full text-[9px] font-black uppercase bg-indigo-50 text-indigo-600 tracking-widest">
                       Status: {access.status}
                    </div>
                </div>

                <div className="space-y-3">
                  <button 
                      onClick={() => handleJoinGame(activeTab)} 
                      disabled={!access.canJoin || currentList.players?.some(p => p.uid === userData.id)}
                      className={`w-full py-4 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 ${!access.canJoin || currentList.players?.some(p => p.uid === userData.id) ? 'bg-slate-100 text-slate-300' : 'bg-indigo-600 text-white'}`}
                  >
                      <PlusCircle size={20}/> INCLUIR MEU NOME
                  </button>

                  {familyMembers.length > 0 && (
                      <button 
                          onClick={() => handleJoinFamily(activeTab)} 
                          disabled={!access.canJoin}
                          className={`w-full py-4 rounded-2xl font-black flex items-center justify-center gap-2 shadow-xl shadow-green-100 transition-all active:scale-95 ${!access.canJoin ? 'bg-slate-100 text-slate-300' : 'bg-green-600 text-white hover:bg-green-700'}`}
                      >
                          <Users2 size={20}/> INCLUIR MINHA FAMÍLIA
                      </button>
                  )}
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 overflow-hidden">
                <div className="p-8 border-b flex justify-between items-center bg-indigo-50/20">
                    <h2 className="text-xl font-black text-indigo-900 uppercase italic">Confirmados {activeTab}</h2>
                    <span className="font-black text-indigo-600 text-lg">{currentList.players?.length || 0} / 24</span>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {[...Array(24)].map((_, i) => {
                        const p = currentList.players?.[i];
                        return (
                            <div key={i} className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${p ? (p.paid ? 'bg-green-50 border-green-200 shadow-sm' : 'bg-white border-indigo-100') : 'bg-slate-50/50 border-dashed border-slate-200'}`}>
                                <div className="flex items-center gap-4 truncate">
                                    <span className={`text-[10px] font-black w-4 ${p?.paid ? 'text-green-600' : 'opacity-20'}`}>{i+1}</span>
                                    <p className={`font-black text-sm uppercase ${p ? 'text-slate-800' : 'text-slate-300 italic'}`}>{p ? p.name : 'Livre'}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {p && (userData.isAdmin || userData.isMaster) && (
                                      <button onClick={() => togglePlayerPayment(activeTab, p.uid)} className={`p-2 rounded-lg transition-all ${p.paid ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-400 hover:bg-indigo-100'}`} title="Confirmar Pagamento">
                                        <DollarSign size={16}/>
                                      </button>
                                  )}
                                  {p && (userData.isAdmin || userData.isMaster || p.uid === user.uid) && (
                                      <button onClick={() => handleRemovePlayer(activeTab, p.uid)} className="p-1 text-red-200 hover:text-red-600"><Trash2 size={14}/></button>
                                  )}
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
            <h2 className="text-2xl font-black uppercase italic tracking-tighter">Gerenciar Sócios</h2>
            <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden border border-slate-100">
                {allUsers.map(u => (
                    <div key={u.id} className="p-5 border-b border-slate-50 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div className="flex flex-col">
                                <span className={`font-black text-sm uppercase ${u.paidMonth ? 'text-green-600' : 'text-slate-800'}`}>{u.username}</span>
                                <span className="text-[10px] font-bold text-slate-400 uppercase italic">{u.congregation}</span>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'users', u.id), { paidMonth: !u.paidMonth })} className={`p-2 rounded-xl border ${u.paidMonth ? 'bg-green-600 text-white' : 'text-slate-300 border-slate-200'}`} title="Pagamento Mensal">
                                <CheckSquare size={16}/>
                              </button>
                              <button onClick={() => openFamilySelection(u)} className="text-[9px] font-black px-4 py-2 rounded-xl uppercase bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center gap-2">
                                <Users2 size={12}/> Vínculo
                              </button>
                            </div>
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

        {view === 'finance' && (userData.isAdmin || userData.isMaster) && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <h2 className="text-2xl font-black uppercase italic tracking-tighter">Fluxo de Caixa</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-indigo-600 p-6 rounded-[2rem] text-white shadow-xl">
                <p className="text-[10px] font-black uppercase opacity-60">Saldo Atual</p>
                <p className="text-3xl font-black tracking-tighter mt-1">R$ {finances.balance?.toFixed(2)}</p>
              </div>
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black uppercase text-slate-400">Quadra 19:00</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xl font-black">R$</span>
                  <input type="number" defaultValue={finances.courtCost19} onBlur={(e) => updateCourtCost('19h', parseFloat(e.target.value))} className="w-full text-xl font-black bg-transparent outline-none focus:text-indigo-600" />
                </div>
              </div>
              <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black uppercase text-slate-400">Quadra 21:00</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xl font-black">R$</span>
                  <input type="number" defaultValue={finances.courtCost21} onBlur={(e) => updateCourtCost('21h', parseFloat(e.target.value))} className="w-full text-xl font-black bg-transparent outline-none focus:text-indigo-600" />
                </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
              <h3 className="font-black uppercase text-xs mb-6 flex items-center gap-2"><TrendingUp size={16}/> Lançar Movimentação</h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                updateBalance(parseFloat(e.target.amount.value), e.target.type.value, e.target.desc.value);
                e.target.reset();
              }} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input required name="desc" placeholder="Descrição (Ex: Pagamento Quadra)" className="p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-600" />
                <div className="flex gap-2">
                  <input required name="amount" type="number" placeholder="Valor R$" className="flex-1 p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-600" />
                  <select name="type" className="p-4 bg-slate-50 rounded-2xl font-black uppercase text-[10px]">
                    <option value="add">Entrada</option>
                    <option value="sub">Saída</option>
                  </select>
                </div>
                <button className="sm:col-span-2 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"><PlusCircle size={20}/> CONFIRMAR LANÇAMENTO</button>
              </form>
            </div>

            <div className="bg-white rounded-[2rem] shadow-xl overflow-hidden border border-slate-100">
              <div className="p-6 border-b bg-slate-50 flex items-center gap-2">
                <History size={16}/> <span className="font-black text-xs uppercase italic">Últimas Movimentações</span>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {finances.history?.slice().reverse().map((log, i) => (
                  <div key={i} className="p-4 border-b border-slate-50 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-black uppercase">{log.desc}</p>
                      <p className="text-[9px] text-slate-400 uppercase font-bold">{new Date(log.date).toLocaleDateString()} - Por {log.admin}</p>
                    </div>
                    <span className={`font-black text-sm ${log.type === 'add' ? 'text-green-600' : 'text-red-600'}`}>
                      {log.type === 'add' ? '+' : '-'} R$ {log.amount?.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {userData && (
        <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-2xl border border-slate-200 p-2 rounded-[2.5rem] shadow-2xl z-[60] w-[90%] max-w-sm flex gap-1">
          <button onClick={() => setView('dashboard')} className={`flex-1 flex flex-col items-center py-4 rounded-3xl transition-all ${view === 'dashboard' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400'}`}>
            <Calendar size={18} /><span className="text-[8px] font-black mt-1 uppercase italic">Jogo</span>
          </button>
          {(userData.isAdmin || userData.isMaster) && (
            <>
              <button onClick={() => setView('admin')} className={`flex-1 flex flex-col items-center py-4 rounded-3xl transition-all ${view === 'admin' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400'}`}>
                <Users size={18} /><span className="text-[8px] font-black mt-1 uppercase italic tracking-tighter">Sócios</span>
              </button>
              <button onClick={() => setView('finance')} className={`flex-1 flex flex-col items-center py-4 rounded-3xl transition-all ${view === 'finance' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-100' : 'text-slate-400'}`}>
                <Wallet size={18} /><span className="text-[8px] font-black mt-1 uppercase italic tracking-tighter">Caixa</span>
              </button>
            </>
          )}
        </nav>
      )}
    </div>
  );
}