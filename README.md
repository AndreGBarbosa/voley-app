🏐 Vôlei Elite - Gestão de Arranjos

O Vôlei Elite é uma aplicação web (PWA) desenvolvida para organizar e gerir as listas de presença de jogos de voleibol de forma automatizada e justa. O sistema resolve o problema de concorrência comum em grupos de mensagens, garantindo que o limite de vagas seja respeitado em tempo real.

🚀 Funcionalidades Principais

📋 Gestão de Listas

Dois Horários: Listas separadas para o jogo das 19:00 (Quadra 3) e 21:00 (Quadra 2).

Regras de Acesso Automatizadas:

Mensalistas: Acesso exclusivo de quinta-feira às 13:00 até sexta-feira às 13:00.

Avulsos: Acesso liberado para todos a partir de sexta-feira às 13:00.

Limite Estrito: Máximo de 24 jogadores por lista com trava de segurança.

🔐 Segurança e Níveis de Acesso

Hierarquia de Utilizadores:

Master: O dono do sistema (primeiro a cadastrar). Pode promover Admins.

Admin: Gere mensalistas, financeiro e exporta as listas.

Jogador: Regista-se, entra na lista e gere o seu próprio perfil.

Login Inteligente: Formato Sobrenome.Nome com opção de "Lembrar de mim".

💰 Painel Financeiro

Controle de caixa com histórico de entradas e saídas.

Registo de quem realizou cada lançamento.

📱 Experiência Mobile (PWA)

Instalável como um aplicativo no Android e iPhone.

Exportação: Gera uma imagem (JPG) da lista atualizada para partilha rápida no WhatsApp.

🛠️ Tecnologias Utilizadas

React.js: Biblioteca para a interface do utilizador.

Firebase:

Firestore: Banco de dados em tempo real.

Auth: Sistema de autenticação.

Tailwind CSS v4: Estilização moderna e responsiva.

Lucide React: Ícones do sistema.

html2canvas: Captura de ecrã para gerar o JPG da lista.

⚙️ Como Configurar o Projeto Localmente

1. Clonar o Repositório

git clone [https://github.com/AndreGBarbosa/voley-app.git](https://github.com/AndreGBarbosa/voley-app.git)
cd voley-app


2. Instalar Dependências

npm install


3. Configurar o Firebase

No ficheiro src/App.jsx, substitua o objeto firebaseConfig pelas suas credenciais obtidas no Console do Firebase:

const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "seu-projeto.firebaseapp.com",
  projectId: "seu-projeto",
  storageBucket: "seu-projeto.appspot.com",
  messagingSenderId: "ID",
  appId: "APP_ID"
};


4. Executar o Projeto

npm run dev


📌 Configuração do Banco de Dados (Firestore)

Para que o app funcione corretamente, é necessário criar as seguintes coleções no seu Firestore:

Vá ao Console do Firebase > Firestore Database.

Crie o banco de dados em Modo de Teste.

O app criará automaticamente a estrutura de pastas no caminho:
/artifacts/voley-manager-v3/public/data/...

📄 Licença

Este projeto foi desenvolvido para fins de organização desportiva comunitária. Sinta-se à vontade para o adaptar para o seu grupo de vôlei!
