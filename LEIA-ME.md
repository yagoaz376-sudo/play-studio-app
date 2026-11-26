# Play Studio

Editor para o **TC-Helicon Play Acoustic / Play Electric** pelo cabo USB, sem instalar nada e sem mexer no firmware.
Baseado no projeto [open-acoustic](https://github.com/michaelbeyhs/open-acoustic): os comandos MIDI, o mapa de menus e as imagens vêm de lá.

## O que precisa
- Um PC ou Mac com **Chrome ou Edge**, um Android com **Chrome** (cabo OTG) ou um iPad/iPhone com o app **MidiWeb** (ative o SysEx nas configurações dele). Safari e os outros navegadores de iPhone/iPad não têm Web MIDI.
- O pedal ligado no computador pelo cabo **USB**. O Play usa cabo mini-USB.
- O **VoiceSupport fechado**, porque ele corrompe as mensagens.

## Como abrir
1. Copie a pasta `PlayStudio` inteira, sem tirar nenhum arquivo.
2. Abra o `index.html` no Chrome ou no Edge. Pode dar dois cliques e escolher o Chrome.
3. Clique em **Connect** e permita o acesso **MIDI com SysEx** quando o navegador perguntar.
4. Deixe o pedal na tela de presets.

Para testar sem o pedal, abra a página com um destes finais no endereço:
- `index.html?sim`: simula um Play Acoustic.
- `index.html?sim=pe`: simula um Play Electric.

Se o navegador recusar abrir direto do disco, rode `node serve.js` dentro da pasta e abra http://localhost:8099/.

## As telas
- **Effects:** a cadeia de efeitos da voz e da guitarra. Toque num efeito para ver e ajustar tudo dele.
- **Mix:** os níveis gerais.
- **Setup:** os ajustes globais.
- **Stage:** botões grandes para usar ao vivo (presets, efeitos, HIT e TALK). Cada efeito mostra a imagem dele.
  - **Toque:** liga ou desliga. Um efeito em modo **HIT** alterna só entre HIT e OFF, nunca vira ON.
  - **Segurar:** efeito momentâneo. O efeito inverte (desligado liga, ligado desliga) só enquanto o dedo estiver em cima, e volta ao soltar. Não conta como edição.
  - **Arrastar para o lado:** muda o ajuste principal do efeito, com uma barra mostrando o valor: HardTune = SHIFT, Transducer = DRIVE, Amp = DRIVE, Comp = AMOUNT; os outros = LEVEL. No Play Acoustic, o BodyRez (AMOUNT) e o Comp (MAKEUP GAIN) também aparecem: ficam sempre ligados, então só arrastam. Direita = mais alto, esquerda = mais baixo. Conta como edição (aperte Save pra guardar).
  - Para editar o resto do efeito, use a aba **Efeitos**.
- **BodyRez (Play Acoustic):** na aba Efeitos aparece a curva do EQ (shelf grave/agudo + 2 bandas paramétricas), que muda na hora quando você gira os knobs. As frequências aparecem em Hz com "≈" porque a conversão ainda não foi conferida na tela do pedal.
- **Bluetooth (WIDI):** se o adaptador esconder qual pedal é, o app abre em modo protegido e mostra o botão **É um Play Acoustic**. O app lembra disso para aquele adaptador.
- **A/B:** depois de editar, o botão **A | B** ao lado do Save alterna entre o preset salvo (A) e a sua edição (B). O Save grava o que estiver tocando.
- **LOOP:** na fila do HIT/TAP/TALK (e na tela Pedal). Um toque entra no modo Loop (segura ▼+▲); outro toque sai (manda HIT, que é o EXIT no Loop). O pedal não informa se está em Loop, então se você sair pelo pedal, o botão pode ficar errado.
  - **TAP:** toque no ritmo da música (2 toques ou mais). Define o TEMPO do preset, que o delay da voz e o da guitarra seguem. Fica marcado como editado: aperte Save pra guardar no preset. Com GLOBAL TEMPO ligado no Setup, vale pra todos os presets.
- **Pedal:** os botões do próprio pedal (STORE, BACK, setas, knob, VOCAL FX, GUITAR FX, MIX, FAVORITE, GENRE, SETUP e os footswitches), apertados pela USB. Útil se algum botão do pedal estiver quebrado. Segurar no app é segurar no pedal.
- **Save:** fica sempre no topo e na Stage enquanto o pedal está conectado. Quando você edita alguma coisa pelo app, ele fica azul e aparece **edited**. O Save aperta STORE duas vezes pra salvar no mesmo preset; também serve pra salvar o que foi mudado no próprio pedal.
- **Aviso vermelho de MIDI:** depois de usar os controles do pedal, o app confere o MIDI CTRL e o FILTER. Se algum estiver num valor que trava a USB, aparece um aviso pra voltar o valor antes de desligar o pedal.
- **Pedal na tela (Play Electric):** na aba Efeitos, o botão **Pedal** dentro da caixinha da imagem faz a tela da pedaleira acompanhar o app. Quando você toca num efeito, o app aperta BACK, VOCAL FX ou GUITAR FX e as setas até a mesma página. O Mix abre o MIX, e Stage ou Setup voltam para a tela de presets. Vem desligado. O app nunca gira o knob e nunca entra no SETUP. Se o preset tiver edições não salvas, ele só abre o menu, sem usar as setas: uma seta na tela de presets trocaria o preset e perderia a edição.
- **Tela do pedal (Play Electric):** na aba **Pedal**, a tela azul no meio é uma cópia da tela da pedaleira. Ela mostra o preset ou a página de efeito, com a imagem, os valores e o STYLE, e o MIX. O pedal não manda a tela dele pela USB, então o app acompanha os botões apertados, tanto no app quanto na própria pedaleira. Como o pedal lembra a última página de cada menu, às vezes aparece "?/7": aperte ◀ ou ▶ até a primeira ou a última página, ou abra um efeito com o botão Pedal ligado. O Setup não é acompanhado.
- **Mapper:** descobre quais parâmetros o Play Electric usa.
- **Nome do preset, no topo ou na Stage:** abre a **lista de presets**.
  - **Buscar:** digite parte do nome ou o número; Enter vai pro primeiro resultado.
  - **Segurar ◀ ou ▶** (meio segundo) pula 10 presets da lista; um toque passa um.
  - **Read all presets** pede ao pedal a lista de presets por número (nome, ★ e gêneros), **sem trocar o preset do pedal** e sem mudar o som: uns 5 segundos pra 178 presets. O app faz isso sozinho a cada conexão.
  - A lista mostra os presets do **gênero** escolhido no pedal (Todos, ★ Favoritos…). Toque num preset pra ir até ele: o pedal passa pelos presets do caminho com as setas (não existe comando de ir direto).
  - O app ainda relê o pedal em seguida, pra confirmar os valores.
  - Os valores de cada preset (pra mostrar na hora e pra exportar) ficam salvos quando você passa pelo preset. Ao exportar, o app lê antes os valores que faltam, passando só pelos presets exportados.
  - Pra chegar num preset, o pedal passa pelos presets do caminho (não existe comando de "ir direto"), então dá pra ouvir a voz mudando rapidinho durante o pulo.
  - Atenção: ler todos os presets troca o preset do pedal, então edições não salvas no preset atual se perdem. O app pergunta antes.
- **Editar com o Claude** (na lista de presets, tocando no nome do preset):
  1. **Copiar preset para o Claude** copia um texto com todos os parâmetros do preset e as opções válidas.
  2. Cole no Claude (no app do iPad, no celular ou no PC) e peça em português, por exemplo: "deixa esse preset com cara de balada, harmonia mais suave e reverb de igreja".
  3. Copie a resposta inteira do Claude, cole na caixa e toque em **Conferir mudanças**. O app mostra o que vai mudar ("Harmony · STYLE: HIGH → LOW") e ignora o que for inválido.
  4. **Aplicar no pedal** manda as mudanças. Ouça: se gostar, **Salvar**; se não, **Desfazer** volta tudo de uma vez.
- **Gênero** (no topo da lista de presets): escolhe quais presets o pedal mostra (Todos, ★ Favoritos, POP, ROCK…). O app faz no pedal o mesmo que o botão GENRE (GENRE, knob, GENRE), confirma e relê a lista desse gênero. Com **★ Favoritos**, a lista e o "Exportar todos os presets" ficam só com os favoritos.
- **★ Favorito:** a estrela ao lado do nome do preset (no topo, em todas as telas, e na Palco) marca ou desmarca o preset atual como favorito: o app aperta o botão FAVORITE do próprio pedal e confirma lendo o pedal. Acesa = favorito.
- **Exportar presets** (na lista de presets, nos dois pedais; aparece depois da primeira leitura completa): gera um arquivo `play-presets-play-acoustic-DATA.json` com todos os presets lidos (voz e guitarra). No iPad/celular abre o menu de compartilhar (WhatsApp, Arquivos, e-mail); no computador o arquivo é baixado. Ao tocar em **Exportar presets** abre uma janelinha: **Todos os presets** ou **Só favoritos** (os marcados com ★). Só lê a lista salva, não muda nada no pedal.
- **Passar a voz de um pedal pro outro (Acoustic ↔ Electric):** no pedal de origem, **Editar com o Claude → Copiar preset para o Claude** e mande o texto (WhatsApp, e-mail…). No outro pedal, abra **Editar com o Claude**, cole o texto na caixa de baixo (não precisa passar pelo Claude), **Conferir mudanças**, **Aplicar no pedal** e **Salvar**. Entre modelos diferentes só os efeitos de voz vêm; os números (como o tempo do reverb) são convertidos pelo valor mostrado no pedal.
- **EN | PT, ao lado do Save:** troca o idioma do app entre inglês e português. Os nomes dos efeitos, estilos e presets continuam como no pedal. A escolha fica salva neste navegador.
- **Bolinha verde embaixo, à esquerda:** abre a conexão e o **monitor MIDI**, com tudo o que entra e sai.

## Segurança (já vem embutida)
- O app **nunca** envia nada para **MIDI CTRL, FILTER, SYSEXID** e os canais MIDI. Mudar MIDI CTRL ou FILTER pode travar o controle pela USB.
- **Não mexa nesses ajustes pelo próprio pedal.** Se o pedal parar de responder pela USB, a saída é o reset de fábrica: segurar **STORE + BACK** enquanto liga o pedal. **Isso apaga todos os presets.**
- O app só altera parâmetros que existem no menu do pedal. Os valores na tela sempre vêm do pedal. O que ainda não foi lido aparece como `··`.

## Play Electric: modo protegido
O mapa de parâmetros que existe hoje é do **Play Acoustic**. No Play Electric, os números dos parâmetros podem ser outros. Por isso, com o Play Electric o app **não altera nada** até cada parâmetro ser confirmado no **Mapper**:

1. **Mapper → Read all.** O app lê os 948 parâmetros. Só lê, não muda nada, e demora mais ou menos 15 a 60 segundos.
2. **Mexa em UMA coisa no próprio pedal.** Por exemplo, gire o REVERB LEVEL da guitarra.
3. O app relê e mostra o que mudou. Escolha o que foi ("This is…") e clique em **Confirm**.
4. Repita para cada controle. Os confirmados viram editáveis na tela Effects.
5. No fim, clique em **Export map** e mande o arquivo `play-electric-map.json` de volta. É ele que completa o app para o Play Electric.

O botão **TALK**, na tela **Stage**, corta os efeitos pra você falar entre as músicas. Funciona como liga/desliga:
- **Um toque liga:** aparece "FX MUTED · TAP TO SING".
- **Outro toque desliga.**

Em cada toque, o app segura o footswitch HIT por 1,3 segundo, igual a segurar o footswitch de verdade. O pedal não informa se o TALK está ligado. Por isso, o aceso/apagado do botão é a contagem de toques feita pelo app, e quem confirma é a tela do pedal.

Os botões de preset ◀ ▶, o HIT e o TALK funcionam simulando os botões do próprio pedal. No Play Electric isso ainda é **experimental**.

## Se algo der errado
- **"No Play Acoustic answered":** feche o VoiceSupport, desconecte e reconecte o cabo, depois clique em **Connect / retry** no painel de conexão.
- **O preset não muda:** deixe o pedal na tela de presets, fora dos menus.
- **Para relatar um problema:** abra o painel de conexão (bolinha verde), clique em **Copy** no monitor MIDI e mande o texto copiado junto com a descrição.
