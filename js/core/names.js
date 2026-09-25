/* MAGGAR.io — bot names and school-friendly chat lines (English + Turkish) */
(function (MG) {
  'use strict';
  const U = MG.U;

  const POOLS = {
    en: {
      first: ['Alex', 'Mia', 'Leo', 'Zoe', 'Max', 'Luna', 'Sam', 'Noah', 'Ava', 'Kai', 'Ella', 'Finn', 'Nora', 'Eli', 'Ivy',
        'Omar', 'Yuki', 'Mateo', 'Aria', 'Liam', 'Sofia', 'Ben', 'Chloe', 'Ryan', 'Maya', 'Theo', 'Lily', 'Jake', 'Emma', 'Deniz'],
      adj: ['Swift', 'Silent', 'Sweet', 'Sleepy', 'Crazy', 'Blue', 'Purple', 'Golden', 'Night', 'Neon', 'Tiny', 'Giant',
        'Super', 'Cosmic', 'Frosty', 'Fiery', 'Sneaky', 'Shiny', 'Turbo', 'Mega'],
      noun: ['Panda', 'Fox', 'Cat', 'Eagle', 'Whale', 'Tiger', 'Dragon', 'Rocket', 'Cloud', 'Star', 'Penguin', 'Owl', 'Bolt',
        'Storm', 'Comet', 'Planet', 'Robot', 'Ninja', 'Jelly', 'Bubble'],
      meme: ['Earth', 'Moon', 'Mars', 'Pluto', 'Venus', 'dont eat me', 'just watching', 'im small', 'slow down', 'Mr. Blob',
        'Cell', 'Jelly', 'Blob', 'Bubble', 'noob', 'pro', 'hungry', '🍕', '🐱', '∞', 'Doge', 'not a bot', 'nobody', '?', 'teamer',
        'Sugar', 'Cotton', 'Peanut', 'Nugget', 'Popcorn']
    },
    tr: {
      first: ['Deniz', 'Ece', 'Mert', 'Zeynep', 'Kaan', 'Elif', 'Arda', 'Defne', 'Emir', 'Nehir', 'Yusuf', 'Ada', 'Efe', 'Asya',
        'Kerem', 'Duru', 'Can', 'Lina', 'Baran', 'Mira', 'Ömer', 'İpek', 'Alp', 'Nil', 'Tuna', 'Su', 'Poyraz', 'Ela', 'Aras', 'Beren'],
      adj: ['Hızlı', 'Sessiz', 'Tatlı', 'Uykulu', 'Çılgın', 'Mavi', 'Mor', 'Altın', 'Gece', 'Neon', 'Minik', 'Dev', 'Süper',
        'Kozmik', 'Buzlu', 'Ateşli', 'Gizli', 'Parlak', 'Turbo', 'Mega'],
      noun: ['Panda', 'Tilki', 'Kedi', 'Kartal', 'Balina', 'Kaplan', 'Ejderha', 'Roket', 'Bulut', 'Yıldız', 'Penguen', 'Baykuş',
        'Şimşek', 'Kasırga', 'Kuyruklu', 'Gezegen', 'Robot', 'Ninja', 'Jöle', 'Balon'],
      meme: ['Earth', 'Moon', 'Mars', 'Pluto', 'Venüs', 'beni yeme', 'sadece izliyorum', 'küçüğüm', 'yavaş ol', 'Mr. Blob',
        'Hücre', 'Jöle', 'Top', 'Balon', 'noob', 'pro', 'yemek lazım', '🍕', '🐱', '∞', 'Doge', 'bot değilim', 'kimse', '?',
        'teamer', 'Şeker', 'Pamuk', 'Boncuk', 'Fındık', 'Mısır']
    }
  };
  const TAGS = ['Nova', 'Pixel', 'Blaze', 'Nebula', 'Vortex', 'Echo', 'Orbit', 'Zenith', 'Comet', 'Quasar', 'Frost',
    'Glitch', 'Byte', 'Spark', 'Flux', 'Astro', 'Lumen', 'Rogue', 'Zap', 'Kiwi'];
  const CLAN = ['[TR]', '[GG]', '[Pro]', '[Wolf]', '[ONE]', '[Neo]', '[Z]', '{Ay}', '[EU]', '[7K]'];

  function num() {
    return U.pick(['', '', '', String(U.randInt(1, 99)), String(U.randInt(100, 999)), '07', '34', '06', '35', '_tr', 'TR', 'x', '_yt']);
  }

  const used = new Set();

  function genName() {
    // çoğunlukla seçili dilde, ara sıra diğer dilden (uluslararası sunucu hissi)
    let lang = MG.I18N ? MG.I18N.lang : 'en';
    if (Math.random() < 0.15) lang = lang === 'en' ? 'tr' : 'en';
    const P = POOLS[lang] || POOLS.en;
    const kind = Math.random();
    let n;
    if (kind < 0.26) n = U.pick(P.first) + (U.chance(0.4) ? num() : '');
    else if (kind < 0.46) n = U.pick(P.adj) + U.pick(P.noun) + (U.chance(0.35) ? num() : '');
    else if (kind < 0.62) n = U.pick(TAGS) + (U.chance(0.5) ? num() : '');
    else if (kind < 0.8) n = U.pick(P.meme);
    else if (kind < 0.9) n = U.pick(CLAN) + ' ' + U.pick(U.chance(0.5) ? P.first : TAGS);
    else if (kind < 0.95) n = 'xX_' + U.pick(TAGS) + '_Xx';
    else n = U.pick(P.first).toLowerCase() + '.' + U.pick(P.noun).toLowerCase();
    return n.slice(0, 15);
  }

  MG.Names = {
    botName() {
      for (let i = 0; i < 8; i++) {
        const n = genName();
        if (!used.has(n)) { used.add(n); return n; }
      }
      return genName();
    },
    release(n) { used.delete(n); }
  };

  // Tüm satırlar okul dostu, zararsız ve eğlenceli
  const LINES = {
    en: {
      greet: ['hi 👋', 'hello!', 'hey!', 'hi everyone', 'sup 😄', 'good luck everyone'],
      greetReply: ['hi!', 'hello 😄', 'hey hey', 'welcome!', 'hi, have fun', '👋'],
      teamYes: ['sure 🤝', 'ok, we are a team!', 'deal 😄', 'ok team', 'nice, let\'s grow together'],
      teamNo: ['nah 😅', 'i play solo', 'maybe later', 'hmm, not now'],
      thanksReply: ['you\'re welcome 😊', 'np', '👍', 'anytime!'],
      gg: ['gg', 'good game 🎮', 'gg wp', 'that was fun', 'nice match'],
      ate: ['hehe 😋', 'yum', 'tasty 😄', 'delicious', 'thanks 😎', 'too easy', 'gotcha!'],
      eaten: ['ahh 😭', 'nooo', 'how?!', 'next time!', 'so unlucky', 'where did that come from 😵', 'ok ok...', 'i\'ll be back 😤'],
      top1: ['i\'m on top 😎', '#1 is mine!', 'nobody can catch me 🚀', 'i\'m the leader 👑'],
      help: ['need help 🆘', 'save me', 'being chased!!', 'someone help'],
      helpReply: ['on my way! 🏃', 'hang on!', 'where are you?'],
      helpNo: ['you\'re on your own 😅', 'run run!', 'hide under a virus!'],
      tauntReply: ['😏', 'we\'ll see', 'hehe', 'don\'t be so sure 😄'],
      feed: ['here you go 🎁', 'a gift!', 'grow a bit 😄', 'mass for my teammate'],
      betray: ['weren\'t we a team? 😤', 'i won\'t forget this 😠', 'team is over!'],
      revenge: ['your turn 😏', 'rematch time!', 'i remember you 👀'],
      rival: ['you\'ve been on top too long 😏', 'you\'re my next target 👀', 'coming for your crown'],
      join: ['hi 👋', 'i\'m here!', 'let\'s go', 'this time i\'ll win'],
      leave: ['that\'s it for me, bb 👋', 'gotta do homework, see ya', 'bb'],
      random: ['this map is so cool', 'anyone want to team?', 'just farming 🍕', 'careful with viruses',
        'please don\'t eat me 😅', 'lucky day today', 'haha', ':D', 'who is that giant 😳', 'stay away from the green spikes',
        'anyone seen a power orb?', 'lots of food here'],
      event: {
        food_rain: ['it\'s raining food 🍬', 'free food!!', 'everyone to the rain!'],
        golden: ['gold is shining ✨', 'gold hunt!'],
        virus_storm: ['viruses everywhere 😱', 'watch the spikes!'],
        wind: ['we\'re flying 💨', 'wooosh'],
        blackout: ['i can\'t see anything 😨', 'who turned off the lights', 'ambush time 😏'],
        meteor: ['meteor!!', 'look up ☄️', 'avoid the red circles'],
        blackhole: ['black hole opened 🕳️', 'i\'m getting pulled!!'],
        frenzy: ['frenzy time 🔥', 'eating time!'],
        titan: ['what is that 😱', 'titan incoming, run!', 'let\'s beat it together!'],
        power_storm: ['power storm ⚡', 'grab a shield first']
      },
      br: ['zone is closing!', 'go to the center', 'last one wins 🔥'],
      crown: ['the crown will be mine 👑', 'who has the crown?', 'drop the crown!']
    },
    tr: {
      greet: ['selam 👋', 'merhaba!', 'hey!', 'selamlar herkese', 'naber 😄', 'iyi oyunlar herkese'],
      greetReply: ['selam!', 'merhaba 😄', 'hey hey', 'hoş geldin!', 'selam, iyi oyunlar', '👋'],
      teamYes: ['olur 🤝', 'tamam, takımız!', 'anlaştık 😄', 'ok takım', 'süper, birlikte büyüyelim'],
      teamNo: ['yok ya 😅', 'tek başıma takılıyorum', 'belki sonra', 'hmm, şimdilik hayır'],
      thanksReply: ['rica ederim 😊', 'ne demek', '👍', 'her zaman!'],
      gg: ['gg', 'iyi oyun 🎮', 'gg wp', 'iyi oyundu', 'güzel maçtı'],
      ate: ['hehe 😋', 'yum', 'afiyet olsun bana 😄', 'lezzetliydi', 'teşekkürler 😎', 'kolay oldu', 'hop!'],
      eaten: ['ahh 😭', 'nooo', 'nasıl yaa', 'bir dahakine!', 'şansımı sevsinler', 'neredeydi o 😵', 'tamam tamam...', 'geri döneceğim 😤'],
      top1: ['zirvedeyim 😎', '1. sıra benim!', 'kimse yakalayamaz 🚀', 'lider benim 👑'],
      help: ['yardım lazım 🆘', 'kurtarın beni', 'kovalanıyorum!!', 'biri yardım etsin'],
      helpReply: ['geliyorum! 🏃', 'dayan!', 'nerdesin?'],
      helpNo: ['kendi başının çaresine bak 😅', 'kaç kaç!', 'virüsün altına saklan!'],
      tauntReply: ['😏', 'göreceğiz', 'hehe', 'o kadar emin olma 😄'],
      feed: ['al sana 🎁', 'hediye!', 'büyü biraz 😄', 'takım arkadaşıma kütle'],
      betray: ['hani takımdık? 😤', 'bunu unutmayacağım 😠', 'takım bozuldu!'],
      revenge: ['sıra sende 😏', 'rövanş zamanı!', 'seni hatırlıyorum 👀'],
      rival: ['zirve fazla uzun sürdü 😏', 'sıradaki hedefim sensin 👀', 'tacını almaya geliyorum'],
      join: ['selam 👋', 'geldim!', 'hadi bakalım', 'bu sefer kazanacağım'],
      leave: ['benden bu kadar, bb 👋', 'ders çalışmam lazım, görüşürüz', 'bb'],
      random: ['bu harita çok güzel', 'biri takım olmak ister mi?', 'sadece yemek topluyorum 🍕', 'virüslere dikkat',
        'kimse beni yemesin lütfen 😅', 'bugün şanslı günüm', 'haha', ':D', 'kim o dev hücre 😳', 'yeşil dikenlilerden uzak dur',
        'güç küresi gördünüz mü?', 'buralar bereketli'],
      event: {
        food_rain: ['yağmur başladı 🍬', 'bedava yemek!!', 'herkes yağmura!'],
        golden: ['altınlar parlıyor ✨', 'altın avına!'],
        virus_storm: ['her yer virüs 😱', 'dikkat dikenliler!'],
        wind: ['uçuyoruz 💨', 'wooosh'],
        blackout: ['hiçbir şey görmüyorum 😨', 'kim ışıkları kapattı', 'karanlıkta pusu zamanı 😏'],
        meteor: ['meteor!!', 'yukarıya dikkat ☄️', 'kırmızı halkalardan kaçın'],
        blackhole: ['kara delik açıldı 🕳️', 'çekiliyorum!!'],
        frenzy: ['çılgınlık başladı 🔥', 'yeme zamanı!'],
        titan: ['o ne öyle 😱', 'titan geliyor, kaçın!', 'birlikte yenelim onu!'],
        power_storm: ['güç yağmuru ⚡', 'kalkan kapan kazanır']
      },
      br: ['alan daralıyor!', 'merkeze gidin', 'son kalan kazanır 🔥'],
      crown: ['tacı ben alacağım 👑', 'taç kimde?', 'tacı bırak!']
    }
  };

  MG.ChatLines = LINES;
  // Botlar her zaman seçili dilde konuşur
  Object.defineProperty(MG, 'Chat', {
    get() { return LINES[MG.I18N ? MG.I18N.lang : 'en'] || LINES.en; },
    configurable: true
  });
})(window.MG = window.MG || {});
