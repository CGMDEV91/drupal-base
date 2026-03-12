<?php

/**
 * Script para crear 3 tours de prueba con sus tour steps.
 *
 * Uso:
 *   drush php:script create_test_tours.php
 *
 * IMPORTANTE: Antes de ejecutar, cambia el valor de $tour_owner_uid
 * por el UID del usuario que quieres que sea autor de los tours.
 * Puede ser el UID del superadmin (1) o el UID de maria_guide.
 */

// ===========================================================================
// ⚙️  CONFIGURACIÓN — CAMBIA ESTE VALOR
// ===========================================================================
$tour_owner_uid = 1; // ← Pon aquí el UID del autor de los tours
// ===========================================================================

use Drupal\node\Entity\Node;

$node_storage = \Drupal::entityTypeManager()->getStorage('node');
$term_storage = \Drupal::entityTypeManager()->getStorage('taxonomy_term');

// Verificar que el usuario existe
$owner = \Drupal\user\Entity\User::load($tour_owner_uid);
if (!$owner) {
  echo "❌ Error: No existe ningún usuario con UID {$tour_owner_uid}.\n";
  echo "   Cambia el valor de \$tour_owner_uid en el script.\n";
  exit(1);
}
echo "👤 Autor de los tours: " . $owner->getDisplayName() . " (UID: {$tour_owner_uid})\n\n";

// ---------------------------------------------------------------------------
// Helpers para cargar taxonomy terms
// ---------------------------------------------------------------------------

function get_term($vid, $name) {
  $terms = \Drupal::entityTypeManager()
    ->getStorage('taxonomy_term')
    ->loadByProperties(['vid' => $vid, 'name' => $name]);
  return !empty($terms) ? reset($terms) : NULL;
}

// ---------------------------------------------------------------------------
// Definición de los 3 tours
// ---------------------------------------------------------------------------

$tours_data = [

  // ==========================================================================
  // TOUR 1 — Madrid
  // ==========================================================================
  [
    'title'       => 'Historic Madrid: From the Royal Palace to the Prado',
    'description' => 'Discover the heart of Spain\'s capital on this immersive walking tour through Madrid\'s most iconic historic district. Starting at the majestic Royal Palace — one of the largest in Europe — you\'ll journey through centuries of Spanish history, art, and culture. Along the way you\'ll cross the legendary Plaza Mayor, explore the vibrant streets of La Latina, and finish at the world-renowned Museo del Prado, home to masterpieces by Velázquez, Goya, and El Greco. This tour is perfect for first-time visitors and history enthusiasts alike. Comfortable walking shoes are recommended as the route covers approximately 4 kilometres of cobblestone streets and historic plazas.',
    'duration'    => 180,
    'country'     => 'Spain',
    'city'        => 'Madrid',
    'location'    => ['lat' => 40.4168, 'lng' => -3.7038],
    'steps'       => [
      [
        'title'       => 'Palacio Real — The Royal Palace',
        'order'       => 1,
        'location'    => ['lat' => 40.4179, 'lng' => -3.7143],
        'description' => 'Begin your journey at the Palacio Real de Madrid, the official residence of the Spanish Royal Family and one of the most impressive palaces in the world. Built in the 18th century under King Philip V on the ruins of a medieval Moorish castle, this breathtaking Baroque masterpiece contains over 3,400 rooms — although only around 50 are open to the public. As you approach through the Plaza de la Armería, take a moment to admire the sheer scale of the building: 135,000 square metres of floor space clad in limestone and granite. Inside, you\'ll find the Royal Armoury — one of the finest collections of arms and armour in Europe — along with the state dining room, the Throne Room lined in crimson velvet and gold leaf, and the extraordinary ceiling fresco by Giovanni Battista Tiepolo in the Royal Chapel. The palace faces west towards the Casa de Campo park, and on a clear day the views of the Guadarrama mountains from the Plaza de la Armería are simply unforgettable. Allow at least 45 minutes here. Audio guides are available at the entrance in 12 languages.',
      ],
      [
        'title'       => 'Catedral de la Almudena',
        'order'       => 2,
        'location'    => ['lat' => 40.4154, 'lng' => -3.7144],
        'description' => 'Just steps from the Royal Palace stands the Catedral de Santa María la Real de la Almudena, Madrid\'s cathedral and one of the most significant religious buildings in Spain. Its construction began in 1879 and wasn\'t completed until 1993 — over a century of work — making it one of the last great cathedrals built in Europe. The exterior blends Baroque and Neoclassical styles, designed to harmonise with the adjacent Royal Palace, while the interior surprises visitors with a striking neo-Gothic style featuring colourful modern stained glass windows commissioned in the 1990s. The cathedral houses the revered image of Our Lady of Almudena, patron saint of Madrid, whose origins date back to the reconquest of the city in 1083. Climb to the dome for panoramic views of the city and the Manzanares River valley — the small entrance fee is absolutely worth it. The crypt beneath the cathedral is also open to visitors and contains the tomb of José María Escrivá, founder of Opus Dei, who was canonised in 1992.',
      ],
      [
        'title'       => 'Plaza Mayor — The Grand Square',
        'order'       => 3,
        'location'    => ['lat' => 40.4154, 'lng' => -3.7074],
        'description' => 'A ten-minute walk east from the cathedral brings you to one of Europe\'s most magnificent public squares: the Plaza Mayor. Constructed between 1617 and 1619 under King Philip III — whose equestrian statue stands proudly at its centre — this vast rectangular plaza measures 129 by 94 metres and is enclosed on all four sides by uniform Baroque buildings with 237 balconies overlooking the square. Throughout its 400-year history, Plaza Mayor has served as a marketplace, a bullfighting arena, a site for public executions during the Spanish Inquisition, and the setting for beatifications and royal celebrations. Today it is lined with traditional restaurants and cafés — be aware that prices here reflect the prime tourist location. For a more authentic and affordable experience, duck into one of the nine archways leading off the plaza into the surrounding streets of the historic centre. The square is particularly magical in the early morning before the crowds arrive, and in December when it hosts Madrid\'s famous Christmas market. Look up at the Casa de la Panadería on the north side — its elaborate allegorical frescoes were painted in 1992 and are a relatively recent addition to this centuries-old square.',
      ],
      [
        'title'       => 'Mercado de San Miguel',
        'order'       => 4,
        'location'    => ['lat' => 40.4151, 'lng' => -3.7087],
        'description' => 'Just outside the northwest corner of Plaza Mayor, you\'ll find the Mercado de San Miguel, Madrid\'s most celebrated gourmet food market and a temple to Spanish gastronomy. Housed in a stunning early 20th-century cast-iron structure dating from 1916, the market was faithfully restored in 2009 and transformed into a vibrant food hall with over 30 stalls offering the finest produce from across Spain. This is the perfect mid-tour stop to taste vermouth poured from the barrel alongside anchovy-topped pintxos, sample freshly shucked Galician oysters, try artisan cheeses from Castile, or enjoy a glass of cava with jamón ibérico. Unlike many tourist markets, San Miguel strikes a good balance between quality and authenticity — many locals come here for their weekly shopping and to meet friends for a mid-morning aperitivo. The market is at its liveliest between 11am and 2pm on weekdays and throughout the day on weekends. Arrive hungry — resisting the temptation to try a little of everything is nearly impossible. Budget around €10–15 per person for a satisfying tasting experience.',
      ],
      [
        'title'       => 'Museo Nacional del Prado',
        'order'       => 5,
        'location'    => ['lat' => 40.4138, 'lng' => -3.6921],
        'description' => 'Your tour concludes at the Museo Nacional del Prado, one of the greatest art museums in the world and Spain\'s most visited cultural institution. Founded in 1819, the Prado houses a collection of over 20,000 works of art, of which approximately 1,800 are on permanent display across its neoclassical galleries. The museum\'s collection is unrivalled in its depth of Spanish, Flemish, and Italian painting from the 12th to early 20th centuries. The highlights are simply staggering: Velázquez\'s Las Meninas — arguably the most analysed painting in Western art history — hangs in Room 12 and rarely fails to stop visitors in their tracks. Nearby you\'ll find his extraordinary series of royal portraits and mythological scenes. Goya\'s Black Paintings, created directly onto the walls of his home in a period of profound personal darkness, are displayed in Rooms 65-67 and represent some of the most psychologically intense works ever made. El Greco\'s elongated, spiritual figures fill several rooms, while Bosch\'s triptych The Garden of Earthly Delights in Room 56A is one of the most discussed and debated paintings in history. Allow a minimum of two hours — serious art lovers could easily spend an entire day. The museum shop on the ground floor is excellent for art books and quality reproductions.',
      ],
    ],
  ],

  // ==========================================================================
  // TOUR 2 — Barcelona
  // ==========================================================================
  [
    'title'       => 'Gaudí\'s Barcelona: Modernisme and Mediterranean Magic',
    'description' => 'Immerse yourself in the extraordinary architectural vision of Antoni Gaudí on this carefully curated tour through Barcelona\'s most iconic modernist landmarks. From the awe-inspiring spires of the Sagrada Família to the dreamlike terraces of Casa Batlló on the elegant Passeig de Gràcia, this tour reveals why Barcelona is considered one of the world\'s great architectural cities. Beyond Gaudí, the route takes you through the charming streets of the Gothic Quarter, past medieval churches and Roman ruins, and along the vibrant La Rambla to the historic waterfront. A tour that seamlessly blends art, architecture, history, and the irresistible energy of Mediterranean city life.',
    'duration'    => 210,
    'country'     => 'Spain',
    'city'        => 'Barcelona',
    'location'    => ['lat' => 41.3851, 'lng' => 2.1734],
    'steps'       => [
      [
        'title'       => 'Sagrada Família — Gaudí\'s Unfinished Masterpiece',
        'order'       => 1,
        'location'    => ['lat' => 41.4036, 'lng' => 2.1744],
        'description' => 'No visit to Barcelona is complete without standing before the Basílica de la Sagrada Família, Antoni Gaudí\'s extraordinary and still unfinished basilica that has been under continuous construction since 1882. Gaudí devoted the last 43 years of his life to this project, and when he died in 1926 — struck by a tram and initially unrecognised due to his humble appearance — less than a quarter of the church was complete. Construction continues today, funded entirely by entrance fees and private donations, with completion now targeted for around 2026, the centenary of Gaudí\'s death. The exterior is a revelation of organic forms inspired by nature: the Nativity Façade on the east side, the only part completed under Gaudí\'s direct supervision, bursts with naturalistic sculpture depicting the birth of Christ in extraordinary detail. The Passion Façade on the west side, designed by sculptor Josep Maria Subirachs, takes a starker, more angular approach that has divided opinion since its completion. Step inside and prepare to be overwhelmed: the interior forest of branching stone columns supports a ceiling of geometric vaults in gold, green, and blue that filters the light like a living canopy. The effect is unlike anything else in the world of architecture. Book tickets online well in advance — queues without pre-booking can exceed two hours.',
      ],
      [
        'title'       => 'Passeig de Gràcia — Barcelona\'s Grand Boulevard',
        'order'       => 2,
        'location'    => ['lat' => 41.3924, 'lng' => 2.1649],
        'description' => 'From the Sagrada Família, walk southwest along the elegant Passeig de Gràcia, Barcelona\'s most prestigious avenue and an open-air museum of Catalan Modernisme architecture. Laid out in 1860 as part of Ildefons Cerdà\'s revolutionary Eixample urban expansion plan — with its distinctive chamfered street corners and octagonal city blocks — the boulevard quickly became the preferred address for Barcelona\'s wealthy bourgeoisie competing to commission the most impressive buildings. The result is an extraordinary concentration of architectural ambition. The so-called Manzana de la Discordia (Block of Discord) at numbers 35-43 contains three masterpieces by rival architects built within a decade of each other: Domènech i Montaner\'s Casa Lleó Morera (1906) at number 35, Puig i Cadafalch\'s Casa Amatller (1900) at number 41, and Gaudí\'s Casa Batlló (1906) at number 43. Each building represents a completely different interpretation of Modernisme, making this single block one of the most architecturally diverse in the world. The hexagonal pavement tiles, designed by Gaudí himself, were originally created specifically for the Passeig de Gràcia and have since become one of Barcelona\'s most recognised design icons.',
      ],
      [
        'title'       => 'Casa Batlló — The House of Bones',
        'order'       => 3,
        'location'    => ['lat' => 41.3916, 'lng' => 2.1650],
        'description' => 'Casa Batlló at number 43 Passeig de Gràcia is widely considered one of Gaudí\'s greatest achievements and one of the most remarkable buildings ever constructed. Commissioned by industrialist Josep Batlló i Casanovas in 1904 and completed in 1906, the building is a total redesign of an existing structure, transformed by Gaudí into something that appears to have grown organically rather than been built. The façade is covered in a shimmering mosaic of broken ceramic tiles — trencadís — in blue, green, and turquoise that changes colour depending on the angle of the light and time of day. The skeletal balconies that give the building its nickname "Casa dels Ossos" (House of Bones) are said to represent human skulls and bones, though Gaudí himself spoke of the sea and the legend of Saint George and the dragon: the scaly roof representing the dragon\'s back, the tower topped with a cross representing the saint\'s lance. The interior is equally breathtaking: the light well at the centre of the building is lined in tiles that graduate from deep cobalt at the top to pale sky blue at the bottom, ensuring even lighting throughout the building at all times of day. The Magic Nights events on the rooftop terrace in summer are an unforgettable experience — book well ahead.',
      ],
      [
        'title'       => 'Barri Gòtic — The Gothic Quarter',
        'order'       => 4,
        'location'    => ['lat' => 41.3833, 'lng' => 2.1762],
        'description' => 'Leave the modernist grandeur of the Eixample behind and step back 2,000 years into the Barri Gòtic, Barcelona\'s ancient Gothic Quarter and the historic heart of the city. Built on and around the original Roman settlement of Barcino, founded in the 1st century BC, the quarter is a labyrinth of narrow medieval streets, atmospheric plazas, and remarkable historic monuments compressed into a remarkably small area. Begin at the Plaça de Sant Jaume, the political heart of Catalonia, where the Palau de la Generalitat (seat of the Catalan government) and the Ajuntament (City Hall) face each other across the square — both buildings incorporate medieval fabric within their later Renaissance and Baroque exteriors. Head north along Carrer del Bisbe to find the Bridge of Sighs, a neo-Gothic bridge that connects two parts of the Palau de la Generalitat and is one of the most photographed spots in Barcelona. Continue to the magnificent Barcelona Cathedral, construction of which began in 1298 on the site of a Romanesque church. The cathedral\'s cloisters are home to 13 white geese — one for each year of Saint Eulalia\'s life — a tradition maintained for centuries. In the basement of the nearby Museu d\'Història de Barcelona, you can walk above an extraordinarily well-preserved Roman archaeological site covering several city blocks.',
      ],
      [
        'title'       => 'La Barceloneta — The Mediterranean Waterfront',
        'order'       => 5,
        'location'    => ['lat' => 41.3809, 'lng' => 2.1897],
        'description' => 'Complete your Barcelona experience at La Barceloneta, the city\'s beloved beach neighbourhood and its connection to the Mediterranean Sea. This distinctive triangular district, built on reclaimed land in the 18th century to rehouse fishermen displaced by the construction of the Ciutadella fortress, retains much of its original working-class character despite being completely surrounded by tourism. The narrow parallel streets — unusually tight even by Barcelona standards, the result of a deliberate urban planning strategy to maximise shade in the summer heat — are lined with traditional seafood restaurants serving fresh paella, fideuà, and grilled fish straight from the Barceloneta fish market. Head to the beach itself — nearly 4 kilometres of golden sand backed by a palm-lined promenade — and walk north to the Olympic Port, built for the 1992 Barcelona Olympics that transformed the city\'s relationship with its coastline. Frank Gehry\'s enormous copper Fish sculpture catches the late afternoon light magnificently near the Port. For the best views of the city skyline from the sea, take the cable car from the Torre de Sant Sebastià up to Montjuïc — the views are spectacular and the ride itself is a memorable experience. End with a cold Estrella Damm and a plate of fresh anchovies at one of the chiringuitos on the beach as the sun sets over the city.',
      ],
    ],
  ],

  // ==========================================================================
  // TOUR 3 — Rome
  // ==========================================================================
  [
    'title'       => 'Eternal Rome: From the Colosseum to the Trevi Fountain',
    'description' => 'Walk through three thousand years of history on this unforgettable tour of Rome\'s most celebrated landmarks. The Eternal City is unlike anywhere else on earth — a place where an ancient Roman temple stands next to a Renaissance church, where Baroque fountains erupt from medieval piazzas, and where the weight of history is felt on every street corner. This tour takes you from the mighty Colosseum and the Roman Forum — the political and civic heart of the ancient world — through the winding streets of the historic centre to the Vatican Museums, the Sistine Chapel, and the incomparable Trevi Fountain. Whether it\'s your first visit to Rome or your tenth, this city never fails to overwhelm and inspire.',
    'duration'    => 240,
    'country'     => 'Italy',
    'city'        => 'Rome',
    'location'    => ['lat' => 41.9028, 'lng' => 12.4964],
    'steps'       => [
      [
        'title'       => 'The Colosseum — Rome\'s Greatest Arena',
        'order'       => 1,
        'location'    => ['lat' => 41.8902, 'lng' => 12.4922],
        'description' => 'Begin your Roman journey at the Colosseum — the Flavian Amphitheatre — the largest ancient amphitheatre ever built and an enduring symbol of Imperial Rome\'s power, ambition, and brutality. Commissioned by Emperor Vespasian around 70 AD and completed under his son Titus in 80 AD, the Colosseum could hold between 50,000 and 80,000 spectators who came to watch gladiatorial combat, wild animal hunts (venationes), public executions, and dramatic re-enactments of famous battles. The engineering achievement is extraordinary even by modern standards: the elliptical structure is 188 metres long, 156 metres wide, and 48 metres tall, constructed using approximately 100,000 cubic metres of travertine marble — all transported from quarries near Tivoli — along with volcanic tuff, brick, and concrete. The complex system of underground tunnels and chambers (the hypogeum), only recently opened to visitors, housed the animals, gladiators, and mechanical elevators used to raise participants dramatically into the arena. The Colosseum was in continuous use for nearly 400 years before being converted into housing, workshops, a religious complex, and ultimately a quarry during the medieval period — which explains the missing sections of the outer wall. Today it remains one of the most visited monuments in the world, attracting over 7 million visitors annually. Book skip-the-line tickets online — the queues without pre-booking are formidable.',
      ],
      [
        'title'       => 'Roman Forum & Palatine Hill',
        'order'       => 2,
        'location'    => ['lat' => 41.8925, 'lng' => 12.4853],
        'description' => 'Immediately adjacent to the Colosseum lies the Roman Forum — the Foro Romano — the beating heart of the ancient Roman world for over a thousand years. This sprawling archaeological site, now a romantic landscape of towering columns, triumphal arches, ruined temples, and basilicas, was once the centre of Roman public life: the place where elections were held, criminals tried, gladiators honoured, and emperors mourned. Walking through the Forum today requires some imagination to reconstruct its former glory, but the individual monuments are remarkable. The Temple of Saturn (497 BC), one of the oldest temples in Rome, still stands with eight of its grey granite columns intact. The Arch of Titus (81 AD), erected to commemorate the sack of Jerusalem, features interior reliefs showing Roman soldiers carrying the Menorah from the Temple — these images had a profound influence on later triumphal arch design throughout Europe. The Temple of Vesta, where the sacred flame of Rome was kept burning by the Vestal Virgins, is one of the most evocative ruins in the entire complex. From the Forum, climb the Palatine Hill — the most central of Rome\'s seven hills and, according to legend, the location of the city\'s founding by Romulus in 753 BC — for spectacular panoramic views over the Forum below and the Circus Maximus, ancient Rome\'s chariot-racing stadium, on the other side.',
      ],
      [
        'title'       => 'Pantheon — Temple of the Gods',
        'order'       => 3,
        'location'    => ['lat' => 41.8986, 'lng' => 12.4769],
        'description' => 'A twenty-minute walk northwest from the Forum brings you to one of the best-preserved buildings from antiquity and arguably the most influential building in Western architectural history: the Pantheon. Built as a temple to all the gods of ancient Rome, the current structure was commissioned by Emperor Hadrian around 125 AD to replace an earlier temple built by Marcus Agrippa — whose name, confusingly, still appears on the inscription above the entrance porch. The Pantheon\'s survival over nearly 2,000 years is largely due to its conversion into a Christian church in 609 AD, which saved it from the quarrying that destroyed so many other Roman monuments. The building\'s engineering genius is concentrated in its extraordinary dome: at 43.3 metres in diameter, it remained the world\'s largest dome for over 1,300 years until Brunelleschi completed the Florence Cathedral dome in 1436. The dome is a perfect hemisphere — if extended downward, it would exactly touch the floor — and at its apex is the oculus, an open circular hole 8.8 metres in diameter that is the building\'s only source of natural light. The oculus is open to the sky: on rainy days, a slight slope in the floor and concealed drainage channels remove the water that falls in. The tombs of Renaissance painter Raphael and King Victor Emmanuel II of unified Italy are among several notable burials within. Entrance is now ticketed following years of free admission.',
      ],
      [
        'title'       => 'Vatican Museums & Sistine Chapel',
        'order'       => 4,
        'location'    => ['lat' => 41.9065, 'lng' => 12.4536],
        'description' => 'Cross the Tiber River to Vatican City — the world\'s smallest sovereign state at just 44 hectares — to visit the Vatican Museums, one of the largest and most important museum complexes in the world. Founded by Pope Julius II in the early 16th century, the museums contain the accumulated artistic treasures of the Catholic Church spanning nearly 2,000 years of history, displayed across 54 galleries and covering 7 kilometres of corridors if walked in their entirety. The journey through the museums is itself a remarkable experience: the Gallery of Maps features 40 topographical maps of Italy painted between 1580 and 1585 with extraordinary precision; the Gallery of Tapestries displays Flemish tapestries woven from Raphael\'s cartoons in the 1520s; and the Hall of the Candelabra is lined with ancient Roman sculpture of the highest quality. The inevitable and absolute highlight, however, is the Sistine Chapel. Painted by Michelangelo between 1508 and 1512 (the ceiling) and 1536 and 1541 (the Last Judgement on the altar wall), this is one of the supreme achievements in the history of Western art. The famous central panel depicting the Creation of Adam — in which God\'s finger almost touches the languid hand of the first man — is the most reproduced detail, but the ceiling as a whole is a staggering feat of physical endurance and artistic genius by a sculptor who had never previously worked in fresco on any significant scale. Photography without flash is permitted in the museums but not in the Sistine Chapel. Book tickets months in advance for July and August.',
      ],
      [
        'title'       => 'Trevi Fountain — The Most Famous Fountain in the World',
        'order'       => 5,
        'location'    => ['lat' => 41.9009, 'lng' => 12.4833],
        'description' => 'Complete your Roman journey at the Trevi Fountain — the Fontana di Trevi — the largest Baroque fountain in Rome and the most famous fountain in the world. Built into the back wall of Palazzo Poli, the fountain was designed by Nicola Salvi and completed in 1762, nearly three centuries after Pope Nicholas V first commissioned a new terminal fountain for the ancient Acqua Vergine aqueduct in 1453. The central figure is Neptune, god of the sea, riding a shell-shaped chariot pulled by two sea horses — one calm, one wild — guided by Tritons, representing the sea in different moods. The theatrical composition, with figures carved from Carrara marble against a triumphal arch backdrop, is a masterpiece of the late Baroque style. The tradition of throwing a coin into the fountain — which guarantees a return to Rome — was popularised by the 1954 film Three Coins in the Fountain and immortalised by Federico Fellini\'s La Dolce Vita in 1960, in which Anita Ekberg wades through the fountain in an iconic scene. Today approximately €3,000 worth of coins are thrown into the fountain every day — all collected nightly by the city authorities and donated to a charity that provides food for Rome\'s poor. Arrive very early in the morning (before 7am) to experience the fountain without crowds and to see the beautiful play of light on the water and marble in the golden morning sunshine.',
      ],
    ],
  ],

];

// ---------------------------------------------------------------------------
// Crear los tours y sus steps
// ---------------------------------------------------------------------------

foreach ($tours_data as $tour_index => $tour_data) {

  echo "📍 Creando tour: {$tour_data['title']}\n";

  // Verificar si ya existe
  $existing_tour = $node_storage->loadByProperties([
    'type'  => 'tour',
    'title' => $tour_data['title'],
  ]);

  if (!empty($existing_tour)) {
    echo "⏭️  Ya existe, saltando.\n\n";
    continue;
  }

  // Cargar country term
  $country_term = get_term('countries', $tour_data['country']);
  if (!$country_term) {
    echo "⚠️  País '{$tour_data['country']}' no encontrado en la taxonomía. Ejecuta primero import_countries.php\n";
    continue;
  }

  // Cargar city term
  $city_term = get_term('cities', $tour_data['city']);
  if (!$city_term) {
    echo "⚠️  Ciudad '{$tour_data['city']}' no encontrada en la taxonomía. Ejecuta primero import_cities.php\n";
    continue;
  }

  // Crear el tour
  $tour = Node::create([
    'type'                  => 'tour',
    'title'                 => $tour_data['title'],
    'status'                => 1,
    'uid'                   => $tour_owner_uid,
    'langcode'              => 'en',
    'field_description'     => [
      'value'  => $tour_data['description'],
      'format' => 'basic_html',
    ],
    'field_duration'        => $tour_data['duration'],
    'field_country'         => [['target_id' => $country_term->id()]],
    'field_city'            => [['target_id' => $city_term->id()]],
    'field_average_rate'    => '0.00',
    'field_donation_count'  => 0,
    'field_donation_total'  => '0.00',
    'field_revenue_split'   => 'professional',
    'field_location'        => 'POINT(' . $tour_data['location']['lng'] . ' ' . $tour_data['location']['lat'] . ')',
  ]);

  $tour->save();
  echo "   ✅ Tour creado — NID: " . $tour->id() . " | UUID: " . $tour->uuid() . "\n";

  // Crear los tour steps
  foreach ($tour_data['steps'] as $step_data) {
    $step = Node::create([
      'type'               => 'tour_step',
      'title'              => $step_data['title'],
      'status'             => 1,
      'uid'                => $tour_owner_uid,
      'langcode'           => 'en',
      'field_description'  => [
        'value'  => $step_data['description'],
        'format' => 'basic_html',
      ],
      'field_order'        => $step_data['order'],
      'field_tour'         => [['target_id' => $tour->id()]],
      'field_total_completed' => 0,
      'field_location'     => 'POINT(' . $step_data['location']['lng'] . ' ' . $step_data['location']['lat'] . ')',
    ]);
    $step->save();
    echo "      📌 Step {$step_data['order']}: {$step_data['title']} (NID: " . $step->id() . ")\n";
  }

  echo "\n";
}

echo "========================================\n";
echo "✅ Todos los tours han sido creados.\n";
echo "========================================\n\n";
echo "Copia estos UUIDs en las variables de Bruno:\n\n";

// Mostrar UUIDs de los tours creados para Bruno
$created_tours = $node_storage->loadByProperties(['type' => 'tour']);
foreach ($created_tours as $t) {
  echo "  " . $t->getTitle() . "\n";
  echo "  UUID: " . $t->uuid() . "\n\n";
}
