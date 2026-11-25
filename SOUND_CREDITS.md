# Sound credits

Every sound in the game comes from [Freesound](https://freesound.org) under **Creative Commons 0** (public domain; no attribution required, credited anyway). That covers every hit, effect, UI sound and voice, and every drum and instrument in the built-in music. The clips were trimmed to their onset, made mono, peak-normalized to -1 dBFS and encoded at 48-56 kbps (84 files).

Settings -> Sounds & music -> Synthesized switches back to the original synthesized set. That set also plays for the first moment after launch, until the clips have decoded.

## Effects (first set)

| File | Freesound sound | Author | License |
|---|---|---|---|
| `heavy.mp3` | [Bat_hit2](https://freesound.org/s/851452/) | hashtagsmcgee | CC0 |
| `whoosh1.mp3` | [Woosh - Plastic perforated steak spatula 4](https://freesound.org/s/742903/) | Sadiquecat | CC0 |
| `whoosh2.mp3` | [Woosh - Plastic Tray 1](https://freesound.org/s/742942/) | Sadiquecat | CC0 |
| `whoosh3.mp3` | [Swish Single 4](https://freesound.org/s/393811/) | deleted_user_6479820 | CC0 |
| `launch.mp3` | [Swinging staff whoosh (low) 03.wav](https://freesound.org/s/422495/) | Nightflame | CC0 |
| `slam.mp3` | [Fruit Impact 1](https://freesound.org/s/209012/) | OwlStorm | CC0 |
| `boom.mp3` | [Boom and Rattle](https://freesound.org/s/732089/) | GammaGool | CC0 |
| `parry.mp3` | [Sword_Clash (46).wav](https://freesound.org/s/326795/) | JohnBuhr | CC0 |
| `dodge.mp3` | [Woosh 1](https://freesound.org/s/614084/) | mateusboga | CC0 |
| `block.mp3` | [wooden rods single strike.ogg](https://freesound.org/s/275679/) | adharca | CC0 |
| `pickup.mp3` | [Coin_C_06](https://freesound.org/s/350869/) | cabled_mess | CC0 |
| `chain.mp3` | [chains_8drop.wav](https://freesound.org/s/209382/) | coffeeflan | CC0 |
| `clank.mp3` | [clank.wav](https://freesound.org/s/616492/) | Empiremonkey | CC0 |
| `zap1.mp3` | [Cool Lil Laser 1](https://freesound.org/s/643923/) | deadrobotmusic | CC0 |
| `zap2.mp3` | [Zap_C_09](https://freesound.org/s/350916/) | cabled_mess | CC0 |
| `beam.mp3` | [Laser Gun 01](https://freesound.org/s/805193/) | mrspivey | CC0 |
| `grab.mp3` | [GrabItemCloth.wav](https://freesound.org/s/609569/) | CJspellsfish | CC0 |
| `steam.mp3` | [air_blast_small_fast_0_7s.wav](https://freesound.org/s/521499/) | typeoo | CC0 |
| `thunder.mp3` | [Electrocuzer EU FX](https://freesound.org/s/708809/) | FunnyVoices | CC0 |
| `pencil.mp3` | [Putting a pencil on paper to write](https://freesound.org/s/632474/) | ani_music | CC0 |
| `scratch.mp3` | [Pencil writing on paper (4 strokes)](https://freesound.org/s/632477/) | ani_music | CC0 |
| `rustle.mp3` | [paper medium 5.wav](https://freesound.org/s/82382/) | gynation | CC0 |
| `page.mp3` | [Magazine Page](https://freesound.org/s/437121/) | mosaichorse | CC0 |
| `crumple.mp3` | [Bag_04.wav](https://freesound.org/s/458372/) | detamine | CC0 |
| `ping.mp3` | [Ping12.wav](https://freesound.org/s/266742/) | n_audioman | CC0 |
| `staff.mp3` | [Wooden Stick Swing 1_2](https://freesound.org/s/485277/) | Joao_Janz | CC0 |

## Punch hits

Every hit plays one of eleven pre-mixed punches (`hit_l1`-`l4`, `hit_m1`-`m4`, `hit_h1`-`h3`; "light" only means shorter, every punch has a boom and a clack). Each is built offline from three separately shaped parts:
- **Boom:** a deep impact, low-passed at 260 Hz with a 190 Hz bump, lightly saturated. It swells in 8 ms after the contact and decays over 120-260 ms.
- **Punch body:** a Freesound punch cut at its impact. EQ: +7 dB at 210 Hz so the thump carries on phone speakers, −5 dB at 480 Hz, +2 dB at 1.2 kHz. Then saturated and given a short envelope.
- **Clack:** the crack of a movie-style kung-fu punch, high-passed at 1.3 kHz with a +4 dB bump at 3.2 kHz. It's energy-normalized, so every variant gets the same snap, and decays in 14-22 ms.

The three are summed, limited (with padding so the clack's first millisecond isn't crushed) and normalized.

| Part | Freesound sources (all CC0) |
|---|---|
| Punch body | [punch.wav](https://freesound.org/s/104183/) by Ekokubza123; [Major punch](https://freesound.org/s/399183/) by janbezouska; [Punch](https://freesound.org/s/517744/) by danlucaz; [Punch 2.wav](https://freesound.org/s/560325/) by JakeEaton; [Punch2.wav](https://freesound.org/s/566435/) by Merrick079; [Punch 1](https://freesound.org/s/773737/) by qubodup; [Punch 2](https://freesound.org/s/773738/) by qubodup; [Punch 3](https://freesound.org/s/773739/) by qubodup |
| Boom | [boom.wav](https://freesound.org/s/135357/) by Blackie666; [JH 808 1 C (0.5 sec).wav](https://freesound.org/s/679779/) by Johnnie_Holiday |
| Clack | [Kung Fu punch 1](https://freesound.org/s/209392/) by peridactyloptrix; [Kung Fu punch 3](https://freesound.org/s/209490/) by peridactyloptrix; [Kung Fu punch 4](https://freesound.org/s/209627/) by peridactyloptrix; [Punch 1](https://freesound.org/s/209765/) by peridactyloptrix; [Kung Fu punch 5](https://freesound.org/s/210897/) by peridactyloptrix |

## Laser Special

| File | Freesound source (CC0) | Notes |
|---|---|---|
| `laser_charge.mp3` | [Anime Charge Sound.wav](https://freesound.org/s/676451/) by TheLittleCrow | the rising last 1.25 s |
| `laser_blast.mp3` | [heavy beam weapon](https://freesound.org/s/152322/) by deleted_user_1941307 | the first 1.8 s, faded |
| `laser_hum.mp3` | [Laser/Machine humming](https://freesound.org/s/166098/) by Shredster7 | seamless 0.85 s loop, played 22% slower for a deeper hum, 7 Hz wobble |
| `laser_beam.mp3` | [laser](https://freesound.org/s/768431/) by bullsquid_ | seamless 0.85 s loop under the hum, for presence on small speakers |

## Effects, voice and UI

| File | Freesound sound | Author | License |
|---|---|---|---|
| `hurt1.mp3` | [Voice_AdultMale_PainGrunts_07.wav](https://freesound.org/s/547205/) | MrFossy | CC0 |
| `hurt2.mp3` | [Voice_AdultMale_PainGrunts_18.wav](https://freesound.org/s/547197/) | MrFossy | CC0 |
| `hurt3.mp3` | [Voice_AdultMale_PainGrunts_03.wav](https://freesound.org/s/547201/) | MrFossy | CC0 |
| `step1.mp3` | [Sneaker Shoes Quick Forest Footstep 1_8](https://freesound.org/s/504347/) | Joao_Janz | CC0 |
| `step2.mp3` | [Sneaker Shoes Quick Forest Footstep 1_13](https://freesound.org/s/504291/) | Joao_Janz | CC0 |
| `land.mp3` | [land a jump.wav](https://freesound.org/s/540272/) | zepurple | CC0 |
| `tele.mp3` | [Sword drawn](https://freesound.org/s/545695/) | colorsCrimsonTears | CC0 |
| `dart.mp3` | [Knife throw 1.aif](https://freesound.org/s/196562/) | kylepyke | CC0 |
| `rankup.mp3` | [LevelUp.wav](https://freesound.org/s/609335/) | Kenneth_Cooney | CC0 |
| `riser.mp3` | [Cinematic Woosh SFX-009.wav](https://freesound.org/s/648614/) | AudioPapkin | CC0 |
| `qte_good.mp3` | [Retro, Coin 03.wav](https://freesound.org/s/402767/) | LilMati | CC0 |
| `qte_bad.mp3` | [acess denied buzz](https://freesound.org/s/419023/) | Jacco18 | CC0 |
| `ui_move.mp3` | [Soft UI Button Click](https://freesound.org/s/528561/) | Jummit | CC0 |
| `ui_click.mp3` | [Classic Click](https://freesound.org/s/671105/) | adh.dreaming | CC0 |
| `ui_ok.mp3` | [Simple or Cute UI / UX / Interface Pause sound](https://freesound.org/s/836452/) | Feraly_ | CC0 |
| `ui_back.mp3` | [Cartoon UI Back/Cancel](https://freesound.org/s/423168/) | plasterbrain | CC0 |
| `bell.mp3` | [Boxing Bell/Trip Gong](https://freesound.org/s/871008/) | friendlyjoe | CC0 |
| `clear.mp3` | [Congrats](https://freesound.org/s/607207/) | Fupicat | CC0 |
| `gameover.mp3` | [You failed (game jingle)](https://freesound.org/s/626260/) | Rolly-SFX | CC0 |
| `metro_hi.mp3` | [Perc_MetronomeQuartz_hi](https://freesound.org/s/548518/) | LudwigMueller | CC0 |
| `metro_lo.mp3` | [Perc_MetronomeQuartz_lo](https://freesound.org/s/548519/) | LudwigMueller | CC0 |
| `ready.mp3` | [Power Up Charge [Remix of LegoLunatic's Charged laser 151243]](https://freesound.org/s/172631/) | qubodup | CC0 |

## Music instruments

The built-in songs are still sequenced in code, but every drum and note is one of these samples. Pitched samples are re-pitched from the note they were recorded at. That pitch was measured with a YIN pitch detector: bass C#2 (69.1 Hz) and C2 (65.3 Hz), pluck C4 (258.5 Hz), lead C5 (520 Hz), shamisen C4 (261.7 Hz), glass bell C5 (523.7 Hz), pad F2 (87.3 Hz).

| File | Freesound sound | Author | License |
|---|---|---|---|
| `m_kick.mp3` | [Synth Kick 3](https://freesound.org/s/266764/) | Hard3eat | CC0 |
| `m_kick_ac.mp3` | [Acoustic Drum Kick.wav](https://freesound.org/s/424662/) | Sound_Bar_KK | CC0 |
| `m_kick_hard.mp3` | [Kick_Drum_Hard_#3.wav](https://freesound.org/s/190551/) | Renovatio871 | CC0 |
| `m_808.mp3` | [808 Emu.wav](https://freesound.org/s/269100/) | breo2012 | CC0 |
| `m_snare.mp3` | [80's Power Snare](https://freesound.org/s/422679/) | YellowTree | CC0 |
| `m_snare2.mp3` | [snareD08.wav](https://freesound.org/s/50972/) | Matias.Reccius | CC0 |
| `m_clap.mp3` | [Anu Clap 10.wav](https://freesound.org/s/513420/) | pomeroyjoshua | CC0 |
| `m_hat.mp3` | [Hi-Hat Closed Hit - Clean](https://freesound.org/s/674296/) | TheEndOfACycle | CC0 |
| `m_ohat.mp3` | [HHAT Paiste 302+ 14'' semi open PP.wav](https://freesound.org/s/104232/) | minorr | CC0 |
| `m_crash.mp3` | [crash 1.wav](https://freesound.org/s/493687/) | DreStortion | CC0 |
| `m_taiko.mp3` | [taiko.wav](https://freesound.org/s/486140/) | Anuj_Shrestha1 | CC0 |
| `m_taiko2.mp3` | [crdn_cinematic_heavy_drums - 04.wav](https://freesound.org/s/577393/) | choomaque-crispydinner | CC0 |
| `m_sweep.mp3` | [Granular Reversed.wav](https://freesound.org/s/249609/) | staticpony1 | CC0 |
| `m_bass.mp3` | [Bass-Future Bounce Bass 1 #C Key](https://freesound.org/s/828489/) | CAT-FOX_ALEX | CC0 |
| `m_bass2.mp3` | [Analogue synth bass sweep](https://freesound.org/s/738583/) | K.W.555 | CC0 |
| `m_pluck.mp3` | [ReFX Nexus 4 Bullet Time Pluck Preset (One-Shot)](https://freesound.org/s/677224/) | Cloud-10 | CC0 |
| `m_lead.mp3` | [Kygo Real Attack Lead 3 Nexus Pluck](https://freesound.org/s/677774/) | Cloud-10 | CC0 |
| `m_shamisen.mp3` | [Suiko VS-1 Shamisen C4](https://freesound.org/s/729362/) | brotherandroid | CC0 |
| `m_glass.mp3` | [Classic Glass Hit-C6](https://freesound.org/s/865789/) | CAT-FOX_ALEX | CC0 |
| `m_pad.mp3` | [FromInside_pad_loop_c_4s.wav](https://freesound.org/s/245752/) | gis_sweden | CC0 |
