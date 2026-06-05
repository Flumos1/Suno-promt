import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataPath = join(__dirname, "..", "data", "artists.json");

const existing = JSON.parse(await readFile(dataPath, "utf8"));
const existingNames = new Set(existing.map(a => a.name.toLowerCase()));

const E = (id, name, language, languageLabel, genre, subgenre, era, mood, bpm, key, vocals, prompt, tags, free = false, isNew = true) =>
  ({ id, name, language, languageLabel, genre, subgenre, era, mood, bpm, key, vocals, prompt, tags, free, isNew });

const newEntries = [

  // ══════════════════════════════════════════════════════════════════════
  // НЕМЕЦКИЕ / АВСТРИЙСКИЕ — de
  // ══════════════════════════════════════════════════════════════════════

  E("de-bach","Johann Sebastian Bach","de","Немецкие","Classical","Baroque / polyphony","1700s",["intricate","sacred"],120,"D minor","no vocals — harpsichord and Baroque orchestra","1700s Baroque orchestral (classical), harpsichord continuo, Baroque violin ensemble, counterpoint fugue structure, complex interweaving voices, intricate and sacred mood, fits a focused study playlist, 120 BPM, D minor",["classical","Baroque","1700s","intricate","sacred","polyphony"],true),

  E("de-beethoven","Ludwig van Beethoven","de","Немецкие","Classical","Classical / Romantic symphony","1800s",["heroic","dramatic"],120,"C minor","no vocals — full symphony orchestra","1800s Classical-Romantic orchestral (classical), full symphony orchestra, dramatic dynamic contrasts from pianissimo to fortissimo, heroic development sections, powerful and epic mood, fits a cinematic score playlist, 120 BPM, C minor",["classical","symphony","1800s","heroic","dramatic","Beethoven"],true),

  E("de-handel","Georg Friedrich Händel","de","Немецкие","Classical","Baroque / opera / oratorio","1700s",["majestic","ceremonial"],116,"D major","operatic choir and soloists","1700s Baroque oratorio (classical), operatic choir, Baroque trumpet fanfares, strings and basso continuo, majestic ceremonial mood, fits a grand occasion playlist, 116 BPM, D major",["classical","Baroque","oratorio","1700s","majestic","ceremonial"],true),

  E("de-brahms","Johannes Brahms","de","Немецкие","Classical","Romantic / symphony / chamber","1800s",["autumnal","serious"],108,"F major","no vocals — symphonic orchestra","1800s Romantic orchestral (classical), full orchestra with rich brass and woodwinds, warm autumnal harmonics, dense development sections, serious and profound mood, fits a rainy afternoon playlist, 108 BPM, F major",["classical","Romantic","symphony","1800s","autumnal","serious"]),

  E("de-wagner","Richard Wagner","de","Немецкие","Classical","Romantic opera / music drama","1800s",["epic","mythological"],84,"E-flat major","dramatic operatic tenor and soprano with orchestra","1800s Romantic opera (classical), leitmotif-driven orchestration, massive brass section, dramatic Wagnerian soprano and tenor, mythological and epic mood, fits an epic cinematic playlist, 84 BPM, E-flat major",["classical","opera","1800s","epic","mythological","leitmotif"],true),

  E("de-schumann","Robert Schumann","de","Немецкие","Classical","Romantic / piano / lieder","1800s",["lyrical","intimate"],72,"A major","lyrical piano or intimate vocal lieder","1800s Romantic piano (classical), singing lyrical piano melody, intimate chamber setting, poetic and heartfelt delivery, lyrical and intimate mood, fits a candlelit evening playlist, 72 BPM, A major",["classical","Romantic","piano","1800s","lyrical","intimate"]),

  E("de-richard-strauss","Richard Strauss","de","Немецкие","Classical","Late Romantic / tone poem / opera","1900s",["lush","complex"],116,"E-flat major","dramatic soprano over massive orchestra","1900s Late Romantic orchestral (classical), massive orchestra with shimmering strings, complex chromatic harmonies, dramatic soprano, lush and complex mood, fits a dramatic cinematic playlist, 116 BPM, E-flat major",["classical","Late Romantic","tone poem","1900s","lush","complex"]),

  E("de-mahler","Gustav Mahler","de","Немецкие","Classical","Late Romantic / symphony","1900s",["transcendent","vast"],60,"C major","massive orchestra with occasional soprano and choir","1900s Late Romantic symphony (classical), vast orchestral forces, philosophical depth, alternating tender and explosive passages, transcendent and vast mood, fits a meditation playlist, 60 BPM, C major",["classical","Late Romantic","symphony","1900s","transcendent","vast"],true),

  E("de-telemann","Georg Philipp Telemann","de","Немецкие","Classical","Baroque / chamber","1700s",["elegant","courtly"],132,"G major","no vocals — Baroque chamber ensemble","1700s Baroque chamber (classical), oboe d'amore, Baroque flute, strings and continuo, elegant courtly dance rhythms, bright and elegant mood, fits a Baroque dinner playlist, 132 BPM, G major",["classical","Baroque","chamber","1700s","elegant","courtly"]),

  E("de-bruckner","Anton Bruckner","de","Немецкие","Classical","Romantic / cathedral symphony","1800s",["sacred","vast"],72,"D minor","no vocals — massive pipe-organ-like orchestra","1800s Romantic symphony (classical), massive orchestral waves like a cathedral organ, grand brass chorale, sacred and vast mood, fits a spiritual contemplation playlist, 72 BPM, D minor",["classical","Romantic","symphony","1800s","sacred","vast"]),

  // АВСТРИЙСКИЕ — at
  E("at-mozart","Wolfgang Amadeus Mozart","at","Австрийские","Classical","Classical / symphony / opera","1700s",["elegant","radiant"],132,"G major","no vocals — classical orchestra with crystalline clarity","1700s Classical orchestral (classical), crystalline clarity, graceful melodic lines, balanced classical orchestra with elegant woodwinds, radiant and elegant mood, fits a sophisticated dinner playlist, 132 BPM, G major",["classical","Classical era","symphony","1700s","elegant","radiant"],true),

  E("at-schubert","Franz Schubert","at","Австрийские","Classical","Romantic / lieder / piano","1800s",["wandering","tender"],80,"B minor","lyrical tenor voice over piano — lieder style","1800s Romantic lieder (classical), lyrical tenor over intimate piano, tender and wandering melodic lines, poetic German text setting, sad and tender mood, fits a solitary walk playlist, 80 BPM, B minor",["classical","Romantic","lieder","1800s","wandering","tender"],true),

  E("at-haydn","Franz Joseph Haydn","at","Австрийские","Classical","Classical / symphony / string quartet","1700s",["witty","balanced"],120,"D major","no vocals — classical orchestra with playful wit","1700s Classical orchestral (classical), balanced four-part writing, playful wit and surprising dynamic shifts, elegant string quartet texture, cheerful and balanced mood, fits a classical radio playlist, 120 BPM, D major",["classical","Classical era","symphony","1700s","witty","balanced"]),

  E("at-strauss-jr","Johann Strauss II","at","Австрийские","Classical","Romantic / waltz / operetta","1800s",["festive","waltzing"],180,"A major","no vocals — Viennese waltz orchestra","1800s Viennese waltz (classical), lilting 3/4 rhythm, sparkling strings, Viennese operetta orchestra, festive and waltzing mood, fits a New Year ballroom playlist, 180 BPM, A major",["classical","waltz","operetta","1800s","festive","waltzing"],true),

  // ══════════════════════════════════════════════════════════════════════
  // ИТАЛЬЯНСКИЕ — it (расширение классикой)
  // ══════════════════════════════════════════════════════════════════════

  E("it-vivaldi","Antonio Vivaldi","it","Итальянские","Classical","Baroque / concerto grosso","1700s",["energetic","vivid"],160,"E major","no vocals — Baroque string concerto","1700s Baroque concerto (classical), virtuosic solo violin over Baroque string orchestra, rapid sixteenth-note passages, vivid seasonal imagery, energetic and vivid mood, fits a drive playlist, 160 BPM, E major",["classical","Baroque","concerto","1700s","energetic","vivid"],true),

  E("it-verdi","Giuseppe Verdi","it","Итальянские","Classical","Romantic opera / grand opera","1800s",["passionate","theatrical"],92,"E-flat major","dramatic Italian operatic baritone and soprano","1800s Italian Romantic opera (classical), full operatic cast with baritone and soprano, rich orchestral accompaniment, passionate theatrical Italian delivery, dramatic mood, fits an opera night playlist, 92 BPM, E-flat major",["classical","opera","Italian opera","1800s","passionate","theatrical"],true),

  E("it-puccini","Giacomo Puccini","it","Итальянские","Classical","Romantic opera / verismo","1900s",["heartbreak","lush"],76,"E major","soaring Italian lyric soprano over lush orchestra","1900s verismo opera (classical), soaring lyric soprano, lush late-Romantic orchestration, verismo emotional realism, heartbreaking and passionate mood, fits a tearjerker playlist, 76 BPM, E major",["classical","opera","verismo","1900s","heartbreak","lush"],true),

  E("it-rossini","Gioachino Rossini","it","Итальянские","Classical","Bel canto opera / comic opera","1800s",["sparkling","comic"],168,"C major","virtuosic coloratura soprano or comic baritone","1800s bel canto opera (classical), sparkling coloratura soprano, racing orchestral crescendo, comic buffa energy, virtuosic and sparkling mood, fits an opera buffa playlist, 168 BPM, C major",["classical","opera","bel canto","1800s","sparkling","comic"],true),

  E("it-paganini","Niccolò Paganini","it","Итальянские","Classical","Romantic / virtuoso violin concerto","1800s",["diabolical","virtuosic"],184,"B minor","no vocals — virtuoso solo violin with orchestra","1800s Romantic violin concerto (classical), demonic virtuoso solo violin, rapid arpeggios and harmonics, dramatic Romantic orchestra support, diabolical and virtuosic mood, fits a showstopper playlist, 184 BPM, B minor",["classical","concerto","violin","1800s","diabolical","virtuosic"],true),

  E("it-monteverdi","Claudio Monteverdi","it","Итальянские","Classical","Early Baroque / opera (inventor)","1600s",["revolutionary","expressive"],72,"D minor","early operatic tenor with lute and viols","1600s Early Baroque opera (classical), Renaissance-to-Baroque transition, lute continuo, viols, first operatic expressive recitative, revolutionary and expressive mood, fits an early music playlist, 72 BPM, D minor",["classical","Early Baroque","opera","1600s","revolutionary","expressive"]),

  E("it-donizetti","Gaetano Donizetti","it","Итальянские","Classical","Bel canto opera","1800s",["flowing","romantic"],88,"E-flat major","lyrical Italian tenor and soprano — bel canto","1800s bel canto opera (classical), flowing lyrical Italian tenor, elegant vocal ornamentation, romantic Donizettian lyricism, flowing and romantic mood, fits a bel canto playlist, 88 BPM, E-flat major",["classical","opera","bel canto","1800s","flowing","romantic"]),

  E("it-bellini","Vincenzo Bellini","it","Итальянские","Classical","Bel canto opera / vocal","1800s",["melancholic","pure"],72,"F major","pure lyric soprano with simple orchestral support","1800s bel canto opera (classical), pure lyric soprano, long-breathed cantabile lines, simple but expressive orchestra, melancholic and pure mood, fits a moonlit aria playlist, 72 BPM, F major",["classical","opera","bel canto","1800s","melancholic","pure"]),

  E("it-corelli","Arcangelo Corelli","it","Итальянские","Classical","Baroque / sonata / concerto grosso","1600s",["graceful","polished"],112,"D major","no vocals — Baroque string ensemble concerto grosso","1600s Baroque concerto grosso (classical), alternating concertino and ripieno strings, graceful melodic sequences, polished Baroque counterpoint, graceful mood, fits a Baroque salon playlist, 112 BPM, D major",["classical","Baroque","concerto grosso","1600s","graceful","polished"]),

  E("it-leoncavallo","Ruggero Leoncavallo","it","Итальянские","Classical","Verismo opera","1900s",["raw","tragic"],88,"D minor","tragic verismo tenor with passionate delivery","1900s verismo opera (classical), raw tragic tenor, intense dramatic realism, verismo orchestra swell, passionate and tragic mood, fits a tragic opera playlist, 88 BPM, D minor",["classical","opera","verismo","1900s","raw","tragic"]),

  E("it-einaudi","Ludovico Einaudi","it","Итальянские","Classical","Neo-classical / minimalist piano","2000s",["meditative","cinematic"],72,"D minor","solo piano with ambient string accents","2000s neo-classical minimalist (classical), solo piano with slow harmonic rhythm, sparse ambient strings, cinematic emotional arc, meditative and cinematic mood, fits a meditation playlist, 72 BPM, D minor",["classical","neo-classical","minimalist","2000s","meditative","cinematic"],true),

  // ══════════════════════════════════════════════════════════════════════
  // РУССКИЕ — ru (расширение классикой)
  // ══════════════════════════════════════════════════════════════════════

  E("ru-tchaikovsky","Пётр Чайковский","ru","Русские","Classical","Romantic / ballet / symphony","1800s",["passionate","melodic"],120,"B minor","no vocals — Romantic orchestral with sweeping strings","1800s Russian Romantic orchestra (classical), sweeping lyrical strings, rich woodwind melodies, passionate climaxes, emotional and melodic mood, fits a ballet score playlist, 120 BPM, B minor",["classical","Romantic","ballet","symphony","1800s","passionate","melodic"],true),

  E("ru-rachmaninoff","Сергей Рахманинов","ru","Русские","Classical","Romantic / piano concerto","1900s",["nostalgic","lush"],84,"C-sharp minor","no vocals — solo piano with lush Romantic orchestra","1900s Russian Romantic piano concerto (classical), sweeping piano arpeggios, lush late-Romantic orchestration, nostalgic Russian soul, melancholic and lush mood, fits a rainy evening playlist, 84 BPM, C-sharp minor",["classical","Romantic","piano concerto","1900s","nostalgic","lush"],true),

  E("ru-prokofiev","Сергей Прокофьев","ru","Русские","Classical","Modern / ballet / symphony","1900s",["sardonic","dynamic"],152,"D major","no vocals — modern orchestra with percussive piano","1900s Soviet modern orchestra (classical), percussive piano, acerbic harmonies, dynamic rhythmic energy, sardonic and dynamic mood, fits a modern classical playlist, 152 BPM, D major",["classical","modern classical","ballet","1900s","sardonic","dynamic"]),

  E("ru-shostakovich","Дмитрий Шостакович","ru","Русские","Classical","Modern / symphony / string quartet","1900s",["tragic","satirical"],108,"D minor","no vocals — Soviet symphony orchestra","1900s Soviet modern symphony (classical), dark satirical undertones, shattering fortissimo outbursts contrasted with quiet sardonic passages, tragic and complex mood, fits a dark classical playlist, 108 BPM, D minor",["classical","modern classical","symphony","1900s","tragic","satirical"],true),

  E("ru-rimsky-korsakov","Николай Римский-Корсаков","ru","Русские","Classical","Romantic / orchestral fantasy","1800s",["exotic","colorful"],132,"E major","no vocals — coloristic Russian Romantic orchestra","1800s Russian Romantic orchestral (classical), brilliant orchestral colors, exotic Eastern scales, shimmering string textures, colorful and vivid mood, fits an exotic journey playlist, 132 BPM, E major",["classical","Romantic","orchestral","1800s","exotic","colorful"]),

  E("ru-mussorgsky","Модест Мусоргский","ru","Русские","Classical","Romantic / nationalistic / opera","1800s",["dark","nationalistic"],80,"B minor","dramatic Russian bass over nationalistic orchestra","1800s Russian nationalistic opera (classical), powerful Russian bass, bold nationalistic harmonies, dramatic choral scenes, dark and epic mood, fits a Russian epic playlist, 80 BPM, B minor",["classical","Romantic","opera","1800s","dark","nationalistic"]),

  E("ru-scriabin","Александр Скрябин","ru","Русские","Classical","Late Romantic / mystical piano","1900s",["mystical","ecstatic"],100,"F-sharp major","no vocals — mystical solo piano or large orchestra","1900s Late Romantic mystical piano (classical), complex chromatic harmonies, tone clusters, mystical atmosphere, ecstatic climaxes, fits a trance meditation playlist, 100 BPM, F-sharp major",["classical","Late Romantic","piano","1900s","mystical","ecstatic"]),

  E("ru-glinka","Михаил Глинка","ru","Русские","Classical","Romantic / Russian opera (founder)","1800s",["heroic","folk-inflected"],116,"E major","Russian lyric tenor over nationalistic orchestra","1800s Russian nationalistic opera (classical), Russian folk melody influence, lyric tenor, founding father of Russian classical school, heroic and folk-inflected mood, fits a Russian heritage playlist, 116 BPM, E major",["classical","Romantic","opera","1800s","heroic","folk-inflected"],true),

  E("ru-stravinsky","Игорь Стравинский","ru","Русские","Classical","Modern / ballet / neoclassical","1900s",["revolutionary","rhythmic"],160,"C major","no vocals — revolutionary modern orchestra","1900s Modern orchestral (classical), radical polyrhythm, percussive ostinatos, pagan energy, neoclassical wit, revolutionary and rhythmic mood, fits a modern dance playlist, 160 BPM, C major",["classical","modern classical","ballet","1900s","revolutionary","rhythmic"],true),

  E("ru-borodin","Александр Бородин","ru","Русские","Classical","Romantic / orientalist / symphony","1800s",["exotic","heroic"],96,"D major","no vocals — lush Romantic orchestra with Eastern color","1800s Russian orientalist orchestral (classical), lush Romantic harmonies, exotic Eastern scales, expansive Central Asian steppes imagery, heroic and exotic mood, fits a cinematic Russian epic playlist, 96 BPM, D major",["classical","Romantic","symphony","1800s","exotic","heroic"]),

  // ══════════════════════════════════════════════════════════════════════
  // ФРАНЦУЗСКИЕ — fr (расширение классикой)
  // ══════════════════════════════════════════════════════════════════════

  E("fr-debussy","Claude Debussy","fr","Французские","Classical","Impressionist / piano / orchestral","1900s",["shimmering","atmospheric"],60,"D-flat major","no vocals — shimmering impressionist orchestra or piano","1900s French Impressionist (classical), shimmering parallel chords, whole-tone and pentatonic scales, blurred edges of tonality, watercolor orchestral textures, atmospheric and dreamlike mood, fits a sunset playlist, 60 BPM, D-flat major",["classical","Impressionist","1900s","shimmering","atmospheric"],true),

  E("fr-ravel","Maurice Ravel","fr","Французские","Classical","Impressionist / orchestral / ballet","1900s",["precise","colorful"],120,"C major","no vocals — brilliantly orchestrated French ensemble","1900s French Impressionist orchestral (classical), precise and transparent orchestration, brilliant instrumental colors, Spanish influences, meticulous craftsmanship, colorful mood, fits a sophisticated playlist, 120 BPM, C major",["classical","Impressionist","orchestral","1900s","precise","colorful"],true),

  E("fr-berlioz","Hector Berlioz","fr","Французские","Classical","Romantic / programme symphony","1800s",["visionary","dramatic"],120,"C major","no vocals — revolutionary Romantic large orchestra","1800s French Romantic programmatic symphony (classical), idée fixe leitmotif, revolutionary orchestration innovations, idiomatic writing for each instrument, visionary and dramatic mood, fits a dramatic cinematic playlist, 120 BPM, C major",["classical","Romantic","symphony","1800s","visionary","dramatic"]),

  E("fr-bizet","Georges Bizet","fr","Французские","Classical","Romantic / French opera / Carmen","1800s",["fiery","Spanish-tinged"],140,"D minor","dramatic mezzo-soprano with colorful French orchestra","1800s French opera (classical), fiery Spanish-tinged drama, rich mezzo-soprano, vivid orchestral color, passionate and fiery mood, fits a flamenco-opera playlist, 140 BPM, D minor",["classical","opera","French opera","1800s","fiery","Spanish-tinged"],true),

  E("fr-saint-saens","Camille Saint-Saëns","fr","Французские","Classical","Romantic / concerto / orchestral fantasy","1800s",["elegant","witty"],120,"G minor","no vocals — elegant French Romantic orchestra","1800s French Romantic orchestral (classical), elegant melodic clarity, witty animal portraits, virtuosic concerto writing, elegant and witty mood, fits a refined playlist, 120 BPM, G minor",["classical","Romantic","concerto","1800s","elegant","witty"]),

  E("fr-offenbach","Jacques Offenbach","fr","Французские","Classical","Operetta / comic opera","1800s",["sparkling","satirical"],176,"F major","vivacious soprano and comic baritone — French operetta","1800s French operetta (classical), can-can rhythms, sparkling comic soprano, satirical wit, Parisian entertainment spirit, vivacious and satirical mood, fits a cabaret playlist, 176 BPM, F major",["classical","operetta","1800s","sparkling","satirical"],true),

  E("fr-faure","Gabriel Fauré","fr","Французские","Classical","Romantic / sacred / chamber","1800s",["serene","ethereal"],60,"D minor","gentle baritone or soprano over intimate chamber ensemble","1800s French Romantic sacred (classical), gentle ethereal harmonies, serene and consoling, intimate chamber or organ setting, ethereal and serene mood, fits a contemplative playlist, 60 BPM, D minor",["classical","Romantic","sacred","1800s","serene","ethereal"]),

  E("fr-satie","Erik Satie","fr","Французские","Classical","Avant-garde / minimalist piano","1900s",["eccentric","minimal"],48,"G major","no vocals — simple repeated piano figures, gymnopédie style","1900s French minimalist (classical), slow simple piano, open harmonies with spacious silence, eccentric quiet simplicity, minimal and eccentric mood, fits a café-alone playlist, 48 BPM, G major",["classical","minimalist","avant-garde","1900s","eccentric","minimal"],true),

  E("fr-massenet","Jules Massenet","fr","Французские","Classical","Romantic / French opera / melodious","1800s",["lyrical","sentimental"],84,"F major","lyrical French soprano over tender orchestration","1800s French Romantic opera (classical), tender lyric soprano, sentimental melodic lines, elegant French orchestration, lyrical and sentimental mood, fits a French romantic playlist, 84 BPM, F major",["classical","opera","French opera","1800s","lyrical","sentimental"]),

  // ══════════════════════════════════════════════════════════════════════
  // ПОЛЬСКИЕ — pl (расширение классикой)
  // ══════════════════════════════════════════════════════════════════════

  E("pl-chopin","Frédéric Chopin","pl","Польские","Classical","Romantic / piano","1800s",["poetic","passionate"],80,"C-sharp minor","no vocals — solo piano, intimate Romantic style","1800s Romantic solo piano (classical), singing piano cantabile, rubato freedom of tempo, nocturne atmosphere to mazurka dance, poetic and passionate mood, fits a midnight piano playlist, 80 BPM, C-sharp minor",["classical","Romantic","piano","1800s","poetic","passionate"],true),

  // ══════════════════════════════════════════════════════════════════════
  // НОРВЕЖСКИЕ — no (новый регион)
  // ══════════════════════════════════════════════════════════════════════

  E("no-grieg","Edvard Grieg","no","Норвежские","Classical","Romantic / nationalistic / piano concerto","1800s",["Nordic","lyrical"],96,"A minor","no vocals — Nordic Romantic piano and orchestra","1800s Norwegian Romantic (classical), fjord-evoking melodic lines, folk-inflected harmonies, lyrical piano concerto style, Nordic freshness, lyrical and Nordic mood, fits a Scandinavian nature playlist, 96 BPM, A minor",["classical","Romantic","piano concerto","1800s","Nordic","lyrical"],true),

  // ══════════════════════════════════════════════════════════════════════
  // ЧЕШСКИЕ — cs (новый регион)
  // ══════════════════════════════════════════════════════════════════════

  E("cs-dvorak","Antonín Dvořák","cs","Чешские","Classical","Romantic / symphony / American period","1800s",["folk-inflected","nostalgic"],116,"E minor","no vocals — Romantic orchestra with folk melody influence","1800s Czech Romantic orchestral (classical), Bohemian folk melody influence, New World spiritual elements, singing English horn solos, nostalgic and folk-inflected mood, fits a homeland nostalgia playlist, 116 BPM, E minor",["classical","Romantic","symphony","1800s","folk-inflected","nostalgic"],true),

  E("cs-smetana","Bedřich Smetana","cs","Чешские","Classical","Romantic / symphonic poem / nationalistic","1800s",["patriotic","flowing"],88,"E minor","no vocals — Czech nationalistic Romantic orchestra","1800s Czech nationalistic orchestral (classical), flowing river imagery, Bohemian landscapes, patriotic folk-based themes, flowing and patriotic mood, fits a Czech heritage playlist, 88 BPM, E minor",["classical","Romantic","symphonic poem","1800s","patriotic","flowing"]),

  E("cs-janacek","Leoš Janáček","cs","Чешские","Classical","Modern / opera / speech melody","1900s",["raw","Moravian"],120,"D minor","dramatic soprano with asymmetric speech-rhythm orchestra","1900s Moravian modern opera (classical), speech-rhythm melodic cells, raw Moravian folk idioms, intense dramatic soprano, raw and expressive mood, fits a Slavic modern classical playlist, 120 BPM, D minor",["classical","modern classical","opera","1900s","raw","Moravian"]),

  // ══════════════════════════════════════════════════════════════════════
  // ВЕНГЕРСКИЕ — hu (новый регион)
  // ══════════════════════════════════════════════════════════════════════

  E("hu-liszt","Franz Liszt","hu","Венгерские","Classical","Romantic / virtuoso piano / symphonic poem","1800s",["flamboyant","virtuosic"],152,"F-sharp minor","no vocals — virtuoso solo piano or Romantic orchestra","1800s Romantic virtuoso piano (classical), transcendental piano technique, Hungarian rhapsody rhythms, demonic showmanship, flamboyant and virtuosic mood, fits a piano showpiece playlist, 152 BPM, F-sharp minor",["classical","Romantic","piano","symphonic poem","1800s","flamboyant","virtuosic"],true),

  E("hu-bartok","Béla Bartók","hu","Венгерские","Classical","Modern / folk research / percussive","1900s",["percussive","folk-fusion"],132,"C major","no vocals — percussive modern orchestra with folk elements","1900s Hungarian modern (classical), Balkan-folk irregular rhythms, percussive piano writing, folk modal scales, complex polyrhythm, percussive and ethnic mood, fits a world modern classical playlist, 132 BPM, C major",["classical","modern classical","1900s","percussive","folk-fusion"],true),

  E("hu-kodaly","Zoltán Kodály","hu","Венгерские","Classical","Modern / choral / Hungarian folk","1900s",["folk-saturated","choral"],96,"D minor","rich Hungarian folk-infused choir","1900s Hungarian choral (classical), rich unison folk-melody choir, pentatonic Hungarian scales, vibrant choral textures, folk-saturated mood, fits a Hungarian folk choral playlist, 96 BPM, D minor",["classical","choral","1900s","folk-saturated","choral"]),

  // ══════════════════════════════════════════════════════════════════════
  // ФИНСКИЕ — fi (новый регион)
  // ══════════════════════════════════════════════════════════════════════

  E("fi-sibelius","Jean Sibelius","fi","Финские","Classical","Romantic / Nordic / symphony","1900s",["Nordic","epic"],88,"D minor","no vocals — Nordic symphonic orchestra with vast landscape imagery","1900s Nordic Romantic symphony (classical), vast frozen landscape textures, dark Nordic harmonics, brass and woodwind nature imagery, epic and Nordic mood, fits a Northern wilderness playlist, 88 BPM, D minor",["classical","Romantic","symphony","1900s","Nordic","epic"],true),

  // ══════════════════════════════════════════════════════════════════════
  // ЭСТОНСКИЕ — et (новый регион)
  // ══════════════════════════════════════════════════════════════════════

  E("et-part","Arvo Pärt","et","Эстонские","Classical","Contemporary / minimalist / tintinnabuli","1970s",["sacred","crystalline"],40,"D minor","no vocals or pure choir — crystalline silence and single notes","1970s Estonian tintinnabuli minimalism (classical), pure consonant triadic harmony, sacred silence between notes, crystalline transparency, slowly unfolding timelessness, sacred and crystalline mood, fits a deep meditation playlist, 40 BPM, D minor",["classical","minimalist","contemporary","1970s","sacred","crystalline"],true),

  // ══════════════════════════════════════════════════════════════════════
  // АНГЛИЙСКИЕ — en (добавление к зарубежным)
  // ══════════════════════════════════════════════════════════════════════

  E("en-purcell","Henry Purcell","en","Зарубежные","Classical","Baroque / English opera / anthem","1600s",["courtly","expressive"],96,"D minor","countertenor or soprano over English Baroque consort","1600s English Baroque opera (classical), countertenor and soprano, English Baroque consort, ground bass, expressive chromatic lament, courtly and expressive mood, fits a Baroque England playlist, 96 BPM, D minor",["classical","Baroque","English","1600s","courtly","expressive"],true),

  E("en-elgar","Edward Elgar","en","Зарубежные","Classical","Late Romantic / English / ceremonial","1900s",["noble","English"],96,"E-flat major","no vocals — noble English Romantic large orchestra","1900s English Late Romantic (classical), noble English Romantic style, sweeping cello melodies, ceremonial pomp, rich harmonics, noble and English mood, fits a British heritage playlist, 96 BPM, E-flat major",["classical","Late Romantic","English","1900s","noble","English"]),

  E("en-holst","Gustav Holst","en","Зарубежные","Classical","Modern / orchestral suite / cosmic","1900s",["cosmic","powerful"],160,"C major","no vocals — massive cosmic orchestra","1900s British modern orchestral (classical), planetary imagery, massive orchestral forces, Mars-to-Neptune journey, cosmic and powerful mood, fits a space epic playlist, 160 BPM, C major",["classical","modern classical","orchestral","1900s","cosmic","powerful"],true),

  E("en-britten","Benjamin Britten","en","Зарубежные","Classical","Modern / English opera / chamber","1900s",["lyrical","theatrical"],96,"C major","lyrical English tenor in intimate opera setting","1900s British modern opera (classical), lyrical English tenor, chamber-scale orchestra, theatrical storytelling, lyrical and theatrical mood, fits a modern British opera playlist, 96 BPM, C major",["classical","modern classical","opera","1900s","lyrical","theatrical"]),

  E("en-nyman","Michael Nyman","en","Зарубежные","Classical","Minimalist / film score / post-modern","1980s",["propulsive","cinematic"],138,"D minor","no vocals — minimalist ensemble with driving energy","1980s British minimalist (classical), propulsive repeated figures, amplified ensemble, piano-driven, post-modern cinematic style, propulsive and cinematic mood, fits a thriller score playlist, 138 BPM, D minor",["classical","minimalist","film score","1980s","propulsive","cinematic"]),

  E("en-glass","Philip Glass","en","Зарубежные","Classical","Minimalist / hypnotic / film score","1970s",["hypnotic","meditative"],120,"E minor","no vocals — cycling arpeggio ensemble","1970s American minimalist (classical), cycling arpeggiated figures, subtle harmonic shifts, hypnotic trance-like repetition, sparse texture, meditative and hypnotic mood, fits a focus playlist, 120 BPM, E minor",["classical","minimalist","1970s","hypnotic","meditative"],true),

  // ══════════════════════════════════════════════════════════════════════
  // ИСПАНСКИЕ — es (добавление классики)
  // ══════════════════════════════════════════════════════════════════════

  E("es-albeniz","Isaac Albéniz","es","Испанские","Classical","Romantic / Spanish piano / nationalistic","1800s",["flamenco-tinged","vibrant"],140,"E Phrygian","no vocals — piano with Spanish folk colors","1800s Spanish Romantic piano (classical), flamenco-influenced harmonics, guitar-like piano textures, Andalusian scales, vibrant Spanish dance spirit, flamenco-tinged and vibrant mood, fits a Spanish piano playlist, 140 BPM, E Phrygian",["classical","Romantic","Spanish piano","1800s","flamenco-tinged","vibrant"]),

  E("es-de-falla","Manuel de Falla","es","Испанские","Classical","Modern / Spanish / flamenco-infused","1900s",["earthy","dramatic"],132,"D Phrygian","no vocals — Spanish modern orchestra with flamenco edge","1900s Spanish modern orchestral (classical), Andalusian cante jondo influence, flamenco-infused harmonics, dramatic castanets, earthy and dramatic mood, fits a Spanish national music playlist, 132 BPM, D Phrygian",["classical","modern classical","Spanish","1900s","earthy","dramatic"]),

  // ══════════════════════════════════════════════════════════════════════
  // ГРЕЧЕСКИЕ — el (добавление классики)
  // ══════════════════════════════════════════════════════════════════════

  E("el-xenakis","Iannis Xenakis","el","Греческие","Classical","Avant-garde / stochastic music","1950s",["mathematical","dense"],120,"N/A","no vocals — dense stochastic orchestral textures","1950s avant-garde stochastic (classical), mass events of sound based on probability theory, dense orchestral clouds, mathematical composition, extreme and fascinating mood, fits an experimental playlist, 120 BPM, N/A",["classical","avant-garde","contemporary","1950s","mathematical","dense"]),

  // ══════════════════════════════════════════════════════════════════════
  // ЛАТИНОАМЕРИКАНСКИЕ — новые классики
  // ══════════════════════════════════════════════════════════════════════

  E("ar-br-piazzolla","Astor Piazzolla","es","Испанские","Classical","Tango / nuevo tango / chamber","1900s",["passionate","melancholic"],112,"D minor","no vocals — bandoneón with chamber tango orchestra","1900s Buenos Aires nuevo tango (classical), habanera-inflected bandoneón, tango violins, complex polyrhythm, passionate and melancholic mood, fits a Buenos Aires midnight playlist, 112 BPM, D minor",["classical","tango","nuevo tango","1900s","passionate","melancholic"],true),

  E("br-villa-lobos","Heitor Villa-Lobos","pt","Португальские","Classical","Modern / Brazilian national / guitar","1900s",["lush","tropical"],96,"E major","no vocals — Brazilian modern orchestra with guitar","1900s Brazilian nationalistic modern (classical), choro-meets-Romantic-orchestration, Brazilian folk and indigenous melody, lush tropical harmonics, lush and tropical mood, fits a Brazilian classical playlist, 96 BPM, E major",["classical","modern classical","Brazilian","1900s","lush","tropical"]),

];

const toAdd = newEntries.filter(e => !existingNames.has(e.name.toLowerCase()));
const combined = [...existing, ...toAdd];
await writeFile(dataPath, JSON.stringify(combined, null, 2), "utf8");
console.log(`Added ${toAdd.length} classical entries. Total: ${combined.length}`);
const skipped = newEntries.filter(e => existingNames.has(e.name.toLowerCase())).map(e => e.name);
if (skipped.length) console.log("Skipped:", skipped.join(", "));
