# Play Studio

Editor para o **TC-Helicon Play Acoustic / Play Electric** pelo cabo USB, sem instalar nada e sem mexer no firmware.
Baseado no projeto [open-acoustic](https://github.com/michaelbeyhs/open-acoustic): os comandos MIDI, o mapa de menus e as imagens vêm de lá.

## O que precisa
- Um PC ou Mac com **Chrome ou Edge**. Safari e navegadores de iPhone/iPad não têm Web MIDI.
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
  - **Segurar:** abre um popup para editar só aquele efeito.
- **Pedal:** os botões do próprio pedal (STORE, BACK, setas, knob, VOCAL FX, GUITAR FX, MIX, FAVORITE, GENRE, SETUP e os footswitches), apertados pela USB. Útil se algum botão do pedal estiver quebrado. Segurar no app é segurar no pedal.
- **Save:** quando você edita alguma coisa, aparece **edited** e o botão **Save** (no topo e na Stage). O Save aperta STORE duas vezes pra salvar no mesmo preset.
- **Aviso vermelho de MIDI:** depois de usar os controles do pedal, o app confere o MIDI CTRL e o FILTER. Se algum estiver num valor que trava a USB, aparece um aviso pra voltar o valor antes de desligar o pedal.
- **Mapper:** descobre quais parâmetros o Play Electric usa.
- **Nome do preset, no topo ou na Stage:** abre a **lista de presets**.
  - **Read all presets** passa por todos os presets uma vez (uns 2 segundos cada) e guarda os valores neste computador.
  - Depois disso, a lista mostra todos os presets: toque num pra ir direto pra ele. Trocar de preset também fica instantâneo na tela.
  - O app ainda relê o pedal em seguida, pra confirmar os valores.
  - Por enquanto, só funciona no Play Acoustic.
  - Atenção: ler todos os presets troca o preset do pedal, então edições não salvas no preset atual se perdem. O app pergunta antes.
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
