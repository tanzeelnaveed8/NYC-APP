import { insertPrecinct, insertSector } from '../db/repositories/precinctRepository';
import { insertLawCategory, insertLawEntry, updateCategoryCount, getLawStats } from '../db/repositories/lawRepository';
import { insertSquad, insertRdoSchedule } from '../db/repositories/calendarRepository';
import { setDataVersion, getDataVersion, isInitialLoadComplete } from '../db/repositories/syncRepository';
import { resetDatabase, getDatabase } from '../db/database';
import { computeCentroid, computeBoundingBox } from '../utils/geo';
import type { Precinct, Sector, LawCategory, Squad, RdoSchedule } from '../models';

export type LoadProgress = {
  stage: string;
  progress: number; // 0 to 1
};

/**
 * Seeds all initial data from bundled assets.
 * Called during onboarding on first launch.
 */
export async function performInitialDataLoad(
  onProgress?: (p: LoadProgress) => void
): Promise<void> {
  // Check if data exists AND is valid
  const isComplete = await isInitialLoadComplete();
  if (isComplete) {
    // Verify law data actually exists
    const stats = await getLawStats();
    if (stats.categories > 0 && stats.entries > 0) {
      // Upgrade sectors if needed (old installs had only 6 sectors)
      await upgradeSectorsIfNeeded();
      return;
    }
    // Data versions exist but tables are empty - reset and reload
    await resetDatabase();
  }

  try {
    // Stage 1: Seed squads and RDO schedules (fast, hardcoded)
    onProgress?.({ stage: 'Setting up calendar data...', progress: 0.05 });
    await seedSquadsAndSchedules();

    // Stage 2: Seed law library from bundled data
    onProgress?.({ stage: 'Loading law library...', progress: 0.15 });
    await seedLawLibrary();
    await setDataVersion('laws', '1.0.0');

    // Stage 3: Seed precinct boundaries (this is placeholder - actual GeoJSON loading)
    onProgress?.({ stage: 'Loading precinct boundaries...', progress: 0.4 });
    await seedPrecinctData();
    await setDataVersion('precincts', PRECINCT_VERSION);

    // Stage 4: Seed sector boundaries
    onProgress?.({ stage: 'Loading sector boundaries...', progress: 0.7 });
    await seedSectorData();
    await setDataVersion('sectors', SECTOR_VERSION);

    onProgress?.({ stage: 'Complete!', progress: 1.0 });
  } catch (error) {
    console.error('Initial data load failed:', error);
    throw error;
  }
}

// ─── Sector Upgrade ─────────────────────────────────────────────────────────

const PRECINCT_VERSION = '2.0.0';
const SECTOR_VERSION = '2.0.0';

async function upgradeSectorsIfNeeded(): Promise<void> {
  try {
    // Upgrade precincts if shapes changed
    const precinctVer = await getDataVersion('precincts');
    if (!precinctVer || precinctVer.version < PRECINCT_VERSION) {
      const db = await getDatabase();
      await db.runAsync('DELETE FROM precincts');
      await seedPrecinctData();
      await setDataVersion('precincts', PRECINCT_VERSION);
    }

    // Upgrade sectors
    const sectorVer = await getDataVersion('sectors');
    if (!sectorVer || sectorVer.version < SECTOR_VERSION) {
      const db = await getDatabase();
      await db.runAsync('DELETE FROM sectors');
      await seedSectorData();
      await setDataVersion('sectors', SECTOR_VERSION);
    }
  } catch (err) {
    console.warn('[DataLoader] Data upgrade failed:', err);
  }
}

// ─── Squad & RDO Seed Data ───────────────────────────────────────────────────

async function seedSquadsAndSchedules(): Promise<void> {
  const squads: Squad[] = [
    { squadId: 1, squadName: 'Squad 1', displayOrder: 1 },
    { squadId: 2, squadName: 'Squad 2', displayOrder: 2 },
    { squadId: 3, squadName: 'Squad 3', displayOrder: 3 },
    { squadId: 4, squadName: 'Squad 4', displayOrder: 4 },
    { squadId: 5, squadName: 'Squad 5', displayOrder: 5 },
    { squadId: 6, squadName: 'Steady', displayOrder: 6 },
  ];

  for (const squad of squads) {
    await insertSquad(squad);
  }

  // Standard NYPD 15-day rotating pattern: 5-on, 2-off, 5-on, 3-off
  const rotatingPattern = ['W','W','W','W','W','O','O','W','W','W','W','W','O','O','O'];
  const anchorDate = '2026-01-01'; // Reference date for Squad 1

  for (let i = 0; i < 5; i++) {
    const schedule: RdoSchedule = {
      scheduleId: i + 1,
      squadId: i + 1,
      patternType: 'rotating',
      cycleLength: 15,
      patternArray: rotatingPattern,
      anchorDate,
      squadOffset: i * 3, // 0, 3, 6, 9, 12
    };
    await insertRdoSchedule(schedule);
  }

  // Steady radio: fixed Sat/Sun off
  const steadySchedule: RdoSchedule = {
    scheduleId: 6,
    squadId: 6,
    patternType: 'steady',
    cycleLength: 7,
    patternArray: ['O', 'W', 'W', 'W', 'W', 'W', 'O'], // Sun=O, Sat=O
    anchorDate,
    squadOffset: 0,
  };
  await insertRdoSchedule(steadySchedule);
}

// ─── Law Library Seed Data ───────────────────────────────────────────────────

async function seedLawLibrary(): Promise<void> {
  const categories: LawCategory[] = [
    { categoryId: 'penal_law', name: 'Penal Law', displayOrder: 1, entryCount: 0 },
    { categoryId: 'vtl', name: 'Vehicle & Traffic Law', displayOrder: 2, entryCount: 0 },
    { categoryId: 'admin_code', name: 'Administrative Code', displayOrder: 3, entryCount: 0 },
    { categoryId: 'traffic_rules', name: 'Traffic Rules', displayOrder: 4, entryCount: 0 },
  ];

  for (const cat of categories) {
    await insertLawCategory(cat);
  }

  // Sample law entries for each category
  const sampleEntries = [
    // Penal Law
    { categoryId: 'penal_law', sectionNumber: '§ 120.00', title: 'Assault in the third degree', bodyText: 'A person is guilty of assault in the third degree when: 1. With intent to cause physical injury to another person, he causes such injury to such person or to a third person; or 2. He recklessly causes physical injury to another person; or 3. With criminal negligence, he causes physical injury to another person by means of a deadly weapon or a dangerous instrument. Assault in the third degree is a class A misdemeanor.' },
    { categoryId: 'penal_law', sectionNumber: '§ 120.05', title: 'Assault in the second degree', bodyText: 'A person is guilty of assault in the second degree when: 1. With intent to cause serious physical injury to another person, he causes such injury to such person or to a third person; or 2. With intent to cause physical injury to another person, he causes such injury to such person or to a third person by means of a deadly weapon or a dangerous instrument. Assault in the second degree is a class D felony.' },
    { categoryId: 'penal_law', sectionNumber: '§ 120.10', title: 'Assault in the first degree', bodyText: 'A person is guilty of assault in the first degree when: 1. With intent to cause serious physical injury to another person, he causes such injury to such person or to a third person by means of a deadly weapon or a dangerous instrument; or 2. With intent to disfigure another person seriously and permanently, or to destroy, amputate or disable permanently a member or organ of his body, he causes such injury to such person or to a third person. Assault in the first degree is a class B felony.' },
    { categoryId: 'penal_law', sectionNumber: '§ 130.00', title: 'Sex offenses; definitions of terms', bodyText: 'The following definitions are applicable to this article. 1. "Sexual intercourse" has its ordinary meaning and occurs upon any penetration, however slight. 2. "Oral sexual conduct" means conduct between persons consisting of contact between the mouth and the penis, the mouth and the anus, or the mouth and the vulva or vagina.' },
    { categoryId: 'penal_law', sectionNumber: '§ 140.10', title: 'Criminal trespass in the third degree', bodyText: 'A person is guilty of criminal trespass in the third degree when he knowingly enters or remains unlawfully in a building or upon real property which is fenced or otherwise enclosed in a manner designed to exclude intruders or when he enters or remains in a school building in violation of posted rules or regulations. Criminal trespass in the third degree is a class B misdemeanor.' },
    { categoryId: 'penal_law', sectionNumber: '§ 140.20', title: 'Burglary in the third degree', bodyText: 'A person is guilty of burglary in the third degree when he knowingly enters or remains unlawfully in a building with intent to commit a crime therein. Burglary in the third degree is a class D felony.' },
    { categoryId: 'penal_law', sectionNumber: '§ 155.25', title: 'Petit larceny', bodyText: 'A person is guilty of petit larceny when he steals property. Petit larceny is a class A misdemeanor.' },
    { categoryId: 'penal_law', sectionNumber: '§ 155.30', title: 'Grand larceny in the fourth degree', bodyText: 'A person is guilty of grand larceny in the fourth degree when he steals property and when: 1. The value of the property exceeds one thousand dollars; or 2. The property consists of a public record, writing or instrument kept, filed or deposited according to law. Grand larceny in the fourth degree is a class E felony.' },
    { categoryId: 'penal_law', sectionNumber: '§ 160.05', title: 'Robbery in the third degree', bodyText: 'A person is guilty of robbery in the third degree when he forcibly steals property. Robbery in the third degree is a class D felony.' },
    { categoryId: 'penal_law', sectionNumber: '§ 165.40', title: 'Criminal possession of stolen property in the fifth degree', bodyText: 'A person is guilty of criminal possession of stolen property in the fifth degree when he knowingly possesses stolen property, with intent to benefit himself or a person other than an owner thereof or to impede the recovery by an owner thereof. Criminal possession of stolen property in the fifth degree is a class A misdemeanor.' },
    { categoryId: 'penal_law', sectionNumber: '§ 220.03', title: 'Criminal possession of a controlled substance in the seventh degree', bodyText: 'A person is guilty of criminal possession of a controlled substance in the seventh degree when he or she knowingly and unlawfully possesses a controlled substance. Criminal possession of a controlled substance in the seventh degree is a class A misdemeanor.' },
    { categoryId: 'penal_law', sectionNumber: '§ 240.20', title: 'Disorderly conduct', bodyText: 'A person is guilty of disorderly conduct when, with intent to cause public inconvenience, annoyance or alarm, or recklessly creating a risk thereof: 1. He engages in fighting or in violent, tumultuous or threatening behavior; or 2. He makes unreasonable noise; or 3. In a public place, he uses abusive or obscene language. Disorderly conduct is a violation.' },

    // Vehicle & Traffic Law
    { categoryId: 'vtl', sectionNumber: '§ 1110', title: 'Obedience to traffic-control devices', bodyText: 'Every person shall obey the instructions of any official traffic-control device applicable to him placed in accordance with the provisions of this chapter, unless otherwise directed by a traffic or police officer.' },
    { categoryId: 'vtl', sectionNumber: '§ 1120', title: 'Drive on right side of roadway', bodyText: 'Upon all roadways of sufficient width a vehicle shall be driven upon the right half of the roadway.' },
    { categoryId: 'vtl', sectionNumber: '§ 1128', title: 'Driving on roadways laned for traffic', bodyText: 'Whenever any roadway has been divided into two or more clearly marked lanes for traffic the following rules in addition to all others consistent herewith shall apply: (a) A vehicle shall be driven as nearly as practicable entirely within a single lane and shall not be moved from such lane until the driver has first ascertained that such movement can be made with safety.' },
    { categoryId: 'vtl', sectionNumber: '§ 1129', title: 'Following too closely', bodyText: 'The driver of a motor vehicle shall not follow another vehicle more closely than is reasonable and prudent, having due regard for the speed of such vehicles and the traffic upon and the condition of the highway.' },
    { categoryId: 'vtl', sectionNumber: '§ 1144', title: 'Move over law', bodyText: 'The operator of a motor vehicle, upon approaching a stationary authorized emergency vehicle, shall proceed with due caution, shall reduce speed, and shall, if highway conditions permit, move from the lane closest to the emergency vehicle.' },
    { categoryId: 'vtl', sectionNumber: '§ 1163', title: 'Turning movements and required signals', bodyText: 'No person shall turn a vehicle at an intersection unless the vehicle is in proper position upon the roadway, or turn a vehicle to enter a private road or driveway, or otherwise turn a vehicle from a direct course or move right or left upon a roadway unless and until such movement can be made with reasonable safety.' },
    { categoryId: 'vtl', sectionNumber: '§ 1180', title: 'Speed restrictions', bodyText: 'No person shall drive a vehicle at a speed greater than is reasonable and prudent under the conditions and having regard to the actual and potential hazards then existing.' },
    { categoryId: 'vtl', sectionNumber: '§ 1192', title: 'Operating a motor vehicle while intoxicated', bodyText: '1. Driving while ability impaired. No person shall operate a motor vehicle while the person\'s ability to operate such motor vehicle is impaired by the consumption of alcohol. 2. Driving while intoxicated; per se. No person shall operate a motor vehicle while such person has .08 of one per centum or more by weight of alcohol in the person\'s blood.' },
    { categoryId: 'vtl', sectionNumber: '§ 1194', title: 'Chemical tests; implied consent', bodyText: 'Any person who operates a motor vehicle in this state shall be deemed to have given consent to a chemical test of one or more of the following: breath, blood, urine, or saliva, for the purpose of determining the alcoholic and/or drug content of the blood.' },
    { categoryId: 'vtl', sectionNumber: '§ 511', title: 'Operation while license or privilege is suspended or revoked', bodyText: 'A person is guilty of the offense of aggravated unlicensed operation of a motor vehicle in the third degree when such person operates a motor vehicle upon a public highway while knowing or having reason to know that such person\'s license or privilege of operating such motor vehicle is suspended, revoked or otherwise withdrawn.' },

    // Administrative Code
    { categoryId: 'admin_code', sectionNumber: '§ 10-125', title: 'Consumption of alcohol on streets prohibited', bodyText: 'It shall be unlawful for any person to drink or consume any alcoholic beverage, or possess, with intent to drink or consume, an open container containing an alcoholic beverage in any public place except at a block party, feast or similar function for which a permit has been obtained.' },
    { categoryId: 'admin_code', sectionNumber: '§ 10-131', title: 'Firearms - Permits', bodyText: 'It shall be unlawful for any person to have in his or her possession any pistol or revolver without a written permit therefor, issued to him or her by the police commissioner or the licensing officer of the city.' },
    { categoryId: 'admin_code', sectionNumber: '§ 10-133', title: 'Firearms - Rifles and shotguns', bodyText: 'It shall be unlawful for any person to have in his or her possession a rifle or shotgun which has not been registered and for which a certificate of registration and a rifle or shotgun permit have not been issued.' },
    { categoryId: 'admin_code', sectionNumber: '§ 10-203', title: 'Unlawful cutting of trees', bodyText: 'It shall be unlawful for any person, without permission of the commissioner, to remove, injure or destroy any tree on a city street or park.' },
    { categoryId: 'admin_code', sectionNumber: '§ 16-118', title: 'Littering prohibited', bodyText: 'No person shall litter, sweep, throw or cast any ashes, garbage, paper, dust or other material in or upon any street or public place. Violation is punishable by a civil penalty of not less than fifty dollars nor more than two hundred fifty dollars for the first violation.' },
    { categoryId: 'admin_code', sectionNumber: '§ 24-218', title: 'Noise control', bodyText: 'No person shall make, continue or cause or permit to be made or continued any unreasonable noise. Unreasonable noise shall include but shall not be limited to sound, attributable to any device, that exceeds the following prohibited noise levels.' },

    // Traffic Rules
    { categoryId: 'traffic_rules', sectionNumber: '§ 4-08(a)', title: 'Parking, standing, stopping rules', bodyText: 'No person shall park, stop, or stand a vehicle in any of the following places, unless otherwise indicated by posted signs, markings, or other traffic control devices: in a bus stop, within a crosswalk, within an intersection, on a sidewalk.' },
    { categoryId: 'traffic_rules', sectionNumber: '§ 4-08(e)', title: 'Double parking', bodyText: 'No person shall stand or park a vehicle in a roadway adjacent to a vehicle stopped, standing, or parked at the curb or edge of a roadway (double parking). Standing in violation of this rule is punishable by a monetary fine.' },
    { categoryId: 'traffic_rules', sectionNumber: '§ 4-08(f)', title: 'Parking in front of private driveways', bodyText: 'No person shall park a vehicle in front of or within five feet of a private driveway or in front of a public or private entrance or exit.' },
    { categoryId: 'traffic_rules', sectionNumber: '§ 4-11(a)', title: 'Commercial vehicle restrictions', bodyText: 'No person shall operate a commercial vehicle upon any street in a residential district at any time, unless such commercial vehicle is making or has made a delivery or pick-up at such street.' },
    { categoryId: 'traffic_rules', sectionNumber: '§ 4-12(p)', title: 'Bicycles', bodyText: 'Bicyclists must obey all traffic signals and signs. Every person operating a bicycle upon a roadway shall ride in the direction of traffic.' },
  ];

  for (const entry of sampleEntries) {
    await insertLawEntry(entry);
  }

  // Update counts
  for (const cat of categories) {
    await updateCategoryCount(cat.categoryId);
  }
}

// ─── Precinct Seed Data ──────────────────────────────────────────────────────
// Seed with real NYC precinct data (simplified boundaries for demo)

async function seedPrecinctData(): Promise<void> {
  const precincts: Precinct[] = [
    // Manhattan
    { precinctNum: 1, name: '1st Precinct', address: '16 Ericsson Place', phone: '(212) 334-0611', borough: 'Manhattan',
      boundaryJson: '{"type":"Polygon","coordinates":[[[-74.0179,40.7060],[-74.0145,40.7085],[-74.0120,40.7115],[-74.0095,40.7148],[-74.0050,40.7162],[-74.0012,40.7158],[-73.9985,40.7135],[-73.9978,40.7105],[-74.0005,40.7078],[-74.0040,40.7060],[-74.0075,40.7055],[-74.0115,40.7048],[-74.0155,40.7050],[-74.0179,40.7060]]]}',
      centroidLat: 40.7105, centroidLng: -74.0075, boundingBoxJson: '[40.7048,-74.0179,40.7162,-73.9978]' },
    { precinctNum: 5, name: '5th Precinct', address: '19 Elizabeth Street', phone: '(212) 334-0711', borough: 'Manhattan',
      boundaryJson: '{"type":"Polygon","coordinates":[[[-74.0012,40.7158],[-73.9990,40.7175],[-73.9965,40.7198],[-73.9938,40.7210],[-73.9905,40.7202],[-73.9890,40.7180],[-73.9900,40.7155],[-73.9925,40.7140],[-73.9955,40.7138],[-73.9985,40.7135],[-74.0012,40.7158]]]}',
      centroidLat: 40.7177, centroidLng: -73.9953, boundingBoxJson: '[40.7135,-74.0012,40.7210,-73.9890]' },
    { precinctNum: 6, name: '6th Precinct', address: '233 West 10th Street', phone: '(212) 741-4811', borough: 'Manhattan',
      boundaryJson: '{"type":"Polygon","coordinates":[[[-74.0085,40.7285],[-74.0060,40.7310],[-74.0038,40.7340],[-74.0015,40.7365],[-73.9985,40.7355],[-73.9962,40.7338],[-73.9958,40.7310],[-73.9970,40.7290],[-73.9998,40.7275],[-74.0030,40.7270],[-74.0058,40.7272],[-74.0085,40.7285]]]}',
      centroidLat: 40.7318, centroidLng: -74.0015, boundingBoxJson: '[40.7270,-74.0085,40.7365,-73.9958]' },
    { precinctNum: 7, name: '7th Precinct', address: '19 1/2 Pitt Street', phone: '(212) 477-7311', borough: 'Manhattan',
      boundaryJson: '{"type":"Polygon","coordinates":[[[-73.9905,40.7140],[-73.9880,40.7160],[-73.9855,40.7185],[-73.9830,40.7198],[-73.9800,40.7190],[-73.9782,40.7170],[-73.9790,40.7148],[-73.9810,40.7128],[-73.9838,40.7118],[-73.9870,40.7120],[-73.9905,40.7140]]]}',
      centroidLat: 40.7160, centroidLng: -73.9843, boundingBoxJson: '[40.7118,-73.9905,40.7198,-73.9782]' },
    { precinctNum: 9, name: '9th Precinct', address: '321 East 5th Street', phone: '(212) 477-7811', borough: 'Manhattan',
      boundaryJson: '{"type":"Polygon","coordinates":[[[-73.9930,40.7215],[-73.9905,40.7240],[-73.9878,40.7268],[-73.9852,40.7290],[-73.9820,40.7285],[-73.9798,40.7265],[-73.9805,40.7240],[-73.9820,40.7218],[-73.9850,40.7205],[-73.9882,40.7200],[-73.9930,40.7215]]]}',
      centroidLat: 40.7247, centroidLng: -73.9861, boundingBoxJson: '[40.7200,-73.9930,40.7290,-73.9798]' },
    { precinctNum: 10, name: '10th Precinct', address: '230 West 20th Street', phone: '(212) 741-8211', borough: 'Manhattan',
      boundaryJson: '{"type":"Polygon","coordinates":[[[-74.0065,40.7390],[-74.0040,40.7418],[-74.0015,40.7445],[-73.9988,40.7470],[-73.9955,40.7462],[-73.9935,40.7440],[-73.9940,40.7415],[-73.9958,40.7395],[-73.9985,40.7380],[-74.0018,40.7375],[-74.0045,40.7378],[-74.0065,40.7390]]]}',
      centroidLat: 40.7422, centroidLng: -73.9998, boundingBoxJson: '[40.7375,-74.0065,40.7470,-73.9935]' },
    { precinctNum: 13, name: '13th Precinct', address: '230 East 21st Street', phone: '(212) 477-7411', borough: 'Manhattan',
      boundaryJson: '{"type":"Polygon","coordinates":[[[-73.9910,40.7340],[-73.9885,40.7365],[-73.9858,40.7390],[-73.9830,40.7412],[-73.9798,40.7405],[-73.9778,40.7385],[-73.9785,40.7358],[-73.9805,40.7338],[-73.9835,40.7325],[-73.9865,40.7322],[-73.9910,40.7340]]]}',
      centroidLat: 40.7367, centroidLng: -73.9842, boundingBoxJson: '[40.7322,-73.9910,40.7412,-73.9778]' },
    { precinctNum: 14, name: '14th Precinct (Midtown South)', address: '357 West 35th Street', phone: '(212) 239-9811', borough: 'Manhattan',
      boundaryJson: '{"type":"Polygon","coordinates":[[[-74.0010,40.7488],[-73.9985,40.7510],[-73.9958,40.7538],[-73.9930,40.7565],[-73.9898,40.7560],[-73.9870,40.7548],[-73.9858,40.7525],[-73.9868,40.7500],[-73.9892,40.7482],[-73.9925,40.7472],[-73.9960,40.7475],[-74.0010,40.7488]]]}',
      centroidLat: 40.7524, centroidLng: -73.9930, boundingBoxJson: '[40.7472,-74.0010,40.7565,-73.9858]' },
    { precinctNum: 17, name: '17th Precinct', address: '167 East 51st Street', phone: '(212) 826-3211', borough: 'Manhattan',
      boundaryJson: '{"type":"Polygon","coordinates":[[[-73.9790,40.7538],[-73.9765,40.7560],[-73.9738,40.7585],[-73.9710,40.7608],[-73.9680,40.7600],[-73.9660,40.7580],[-73.9668,40.7555],[-73.9688,40.7535],[-73.9718,40.7522],[-73.9750,40.7520],[-73.9790,40.7538]]]}',
      centroidLat: 40.7567, centroidLng: -73.9724, boundingBoxJson: '[40.7520,-73.9790,40.7608,-73.9660]' },
    { precinctNum: 18, name: '18th Precinct (Midtown North)', address: '306 West 54th Street', phone: '(212) 767-8400', borough: 'Manhattan',
      boundaryJson: '{"type":"Polygon","coordinates":[[[-73.9942,40.7590],[-73.9918,40.7615],[-73.9890,40.7642],[-73.9862,40.7668],[-73.9830,40.7660],[-73.9810,40.7640],[-73.9818,40.7615],[-73.9838,40.7595],[-73.9868,40.7580],[-73.9900,40.7575],[-73.9942,40.7590]]]}',
      centroidLat: 40.7625, centroidLng: -73.9876, boundingBoxJson: '[40.7575,-73.9942,40.7668,-73.9810]' },
    { precinctNum: 19, name: '19th Precinct', address: '153 East 67th Street', phone: '(212) 452-0600', borough: 'Manhattan',
      boundaryJson: '{"type":"Polygon","coordinates":[[[-73.9760,40.7640],[-73.9738,40.7668],[-73.9712,40.7698],[-73.9688,40.7730],[-73.9655,40.7725],[-73.9632,40.7705],[-73.9640,40.7675],[-73.9658,40.7650],[-73.9688,40.7635],[-73.9720,40.7630],[-73.9760,40.7640]]]}',
      centroidLat: 40.7685, centroidLng: -73.9695, boundingBoxJson: '[40.7630,-73.9760,40.7730,-73.9632]' },
    { precinctNum: 20, name: '20th Precinct', address: '120 West 82nd Street', phone: '(212) 580-6411', borough: 'Manhattan',
      boundaryJson: '{"type":"Polygon","coordinates":[[[-73.9832,40.7768],[-73.9808,40.7795],[-73.9782,40.7825],[-73.9758,40.7858],[-73.9725,40.7850],[-73.9705,40.7830],[-73.9712,40.7802],[-73.9730,40.7778],[-73.9758,40.7762],[-73.9790,40.7755],[-73.9832,40.7768]]]}',
      centroidLat: 40.7810, centroidLng: -73.9766, boundingBoxJson: '[40.7755,-73.9832,40.7858,-73.9705]' },
    // Brooklyn
    { precinctNum: 60, name: '60th Precinct', address: '2951 West 8th Street', phone: '(718) 946-3311', borough: 'Brooklyn',
      boundaryJson: '{"type":"Polygon","coordinates":[[[-73.9918,40.5738],[-73.9888,40.5758],[-73.9855,40.5780],[-73.9822,40.5798],[-73.9788,40.5790],[-73.9760,40.5775],[-73.9748,40.5752],[-73.9758,40.5730],[-73.9780,40.5712],[-73.9812,40.5705],[-73.9850,40.5710],[-73.9885,40.5720],[-73.9918,40.5738]]]}',
      centroidLat: 40.5752, centroidLng: -73.9832, boundingBoxJson: '[40.5705,-73.9918,40.5798,-73.9748]' },
    { precinctNum: 61, name: '61st Precinct', address: '2575 Coney Island Avenue', phone: '(718) 627-6611', borough: 'Brooklyn',
      boundaryJson: '{"type":"Polygon","coordinates":[[[-73.9690,40.5775],[-73.9658,40.5800],[-73.9625,40.5828],[-73.9590,40.5850],[-73.9555,40.5862],[-73.9520,40.5855],[-73.9498,40.5835],[-73.9510,40.5808],[-73.9535,40.5785],[-73.9568,40.5768],[-73.9605,40.5758],[-73.9648,40.5762],[-73.9690,40.5775]]]}',
      centroidLat: 40.5813, centroidLng: -73.9592, boundingBoxJson: '[40.5758,-73.9690,40.5862,-73.9498]' },
    { precinctNum: 66, name: '66th Precinct', address: '5822 16th Avenue', phone: '(718) 851-5611', borough: 'Brooklyn',
      boundaryJson: '{"type":"Polygon","coordinates":[[[-73.9995,40.6228],[-73.9965,40.6255],[-73.9932,40.6280],[-73.9898,40.6302],[-73.9862,40.6318],[-73.9828,40.6310],[-73.9808,40.6290],[-73.9818,40.6265],[-73.9840,40.6242],[-73.9870,40.6225],[-73.9905,40.6215],[-73.9945,40.6218],[-73.9995,40.6228]]]}',
      centroidLat: 40.6268, centroidLng: -73.9897, boundingBoxJson: '[40.6215,-73.9995,40.6318,-73.9808]' },
    // Bronx
    { precinctNum: 40, name: '40th Precinct', address: '257 Alexander Avenue', phone: '(718) 402-2270', borough: 'Bronx',
      boundaryJson: '{"type":"Polygon","coordinates":[[[-73.9268,40.8088],[-73.9240,40.8112],[-73.9212,40.8140],[-73.9185,40.8165],[-73.9155,40.8178],[-73.9120,40.8170],[-73.9098,40.8148],[-73.9108,40.8122],[-73.9130,40.8098],[-73.9160,40.8080],[-73.9195,40.8072],[-73.9232,40.8075],[-73.9268,40.8088]]]}',
      centroidLat: 40.8126, centroidLng: -73.9182, boundingBoxJson: '[40.8072,-73.9268,40.8178,-73.9098]' },
    { precinctNum: 41, name: '41st Precinct', address: '1035 Longwood Avenue', phone: '(718) 542-4771', borough: 'Bronx',
      boundaryJson: '{"type":"Polygon","coordinates":[[[-73.9068,40.8148],[-73.9040,40.8175],[-73.9012,40.8205],[-73.8982,40.8232],[-73.8948,40.8252],[-73.8912,40.8245],[-73.8890,40.8222],[-73.8902,40.8195],[-73.8925,40.8170],[-73.8958,40.8150],[-73.8995,40.8140],[-73.9035,40.8142],[-73.9068,40.8148]]]}',
      centroidLat: 40.8195, centroidLng: -73.8980, boundingBoxJson: '[40.8140,-73.9068,40.8252,-73.8890]' },
    { precinctNum: 42, name: '42nd Precinct', address: '830 Washington Avenue', phone: '(718) 402-3887', borough: 'Bronx',
      boundaryJson: '{"type":"Polygon","coordinates":[[[-73.9135,40.8235],[-73.9108,40.8260],[-73.9078,40.8290],[-73.9048,40.8318],[-73.9015,40.8338],[-73.8978,40.8330],[-73.8958,40.8308],[-73.8968,40.8280],[-73.8990,40.8255],[-73.9022,40.8238],[-73.9058,40.8228],[-73.9098,40.8230],[-73.9135,40.8235]]]}',
      centroidLat: 40.8283, centroidLng: -73.9042, boundingBoxJson: '[40.8228,-73.9135,40.8338,-73.8958]' },
    // Queens
    { precinctNum: 100, name: '100th Precinct', address: '92-24 Rockaway Beach Blvd', phone: '(718) 318-4200', borough: 'Queens',
      boundaryJson: '{"type":"Polygon","coordinates":[[[-73.8318,40.5788],[-73.8288,40.5808],[-73.8255,40.5832],[-73.8220,40.5852],[-73.8182,40.5865],[-73.8148,40.5858],[-73.8125,40.5838],[-73.8135,40.5812],[-73.8158,40.5790],[-73.8190,40.5772],[-73.8228,40.5762],[-73.8272,40.5768],[-73.8318,40.5788]]]}',
      centroidLat: 40.5818, centroidLng: -73.8222, boundingBoxJson: '[40.5762,-73.8318,40.5865,-73.8125]' },
    { precinctNum: 101, name: '101st Precinct', address: '16-12 Mott Avenue', phone: '(718) 868-3400', borough: 'Queens',
      boundaryJson: '{"type":"Polygon","coordinates":[[[-73.7618,40.5988],[-73.7588,40.6010],[-73.7555,40.6035],[-73.7520,40.6058],[-73.7485,40.6075],[-73.7448,40.6068],[-73.7428,40.6048],[-73.7438,40.6022],[-73.7460,40.5998],[-73.7492,40.5978],[-73.7530,40.5968],[-73.7572,40.5972],[-73.7618,40.5988]]]}',
      centroidLat: 40.6022, centroidLng: -73.7523, boundingBoxJson: '[40.5968,-73.7618,40.6075,-73.7428]' },
    { precinctNum: 102, name: '102nd Precinct', address: '87-34 118th Street', phone: '(718) 805-3200', borough: 'Queens',
      boundaryJson: '{"type":"Polygon","coordinates":[[[-73.8368,40.6888],[-73.8338,40.6912],[-73.8305,40.6938],[-73.8270,40.6960],[-73.8232,40.6972],[-73.8198,40.6965],[-73.8175,40.6945],[-73.8188,40.6918],[-73.8210,40.6895],[-73.8242,40.6878],[-73.8280,40.6868],[-73.8322,40.6872],[-73.8368,40.6888]]]}',
      centroidLat: 40.6920, centroidLng: -73.8272, boundingBoxJson: '[40.6868,-73.8368,40.6972,-73.8175]' },
    // Staten Island
    { precinctNum: 120, name: '120th Precinct', address: '78 Richmond Terrace', phone: '(718) 876-8500', borough: 'Staten Island',
      boundaryJson: '{"type":"Polygon","coordinates":[[[-74.0920,40.6368],[-74.0888,40.6395],[-74.0855,40.6422],[-74.0820,40.6448],[-74.0782,40.6462],[-74.0745,40.6455],[-74.0718,40.6432],[-74.0728,40.6405],[-74.0752,40.6380],[-74.0788,40.6362],[-74.0828,40.6350],[-74.0872,40.6355],[-74.0920,40.6368]]]}',
      centroidLat: 40.6408, centroidLng: -74.0818, boundingBoxJson: '[40.6350,-74.0920,40.6462,-74.0718]' },
    { precinctNum: 122, name: '122nd Precinct', address: '2320 Hylan Boulevard', phone: '(718) 667-2211', borough: 'Staten Island',
      boundaryJson: '{"type":"Polygon","coordinates":[[[-74.1218,40.5688],[-74.1185,40.5715],[-74.1148,40.5742],[-74.1110,40.5768],[-74.1072,40.5782],[-74.1035,40.5775],[-74.1010,40.5752],[-74.1022,40.5725],[-74.1048,40.5700],[-74.1082,40.5680],[-74.1122,40.5668],[-74.1168,40.5672],[-74.1218,40.5688]]]}',
      centroidLat: 40.5726, centroidLng: -74.1118, boundingBoxJson: '[40.5668,-74.1218,40.5782,-74.1010]' },
  ];

  for (const p of precincts) {
    await insertPrecinct(p);
  }
}

async function seedSectorData(): Promise<void> {
  // Auto-generate sector A and B for each precinct by splitting its boundary
  const db = await getDatabase();
  const precincts = await db.getAllAsync<Precinct>('SELECT * FROM precincts');

  for (const p of precincts) {
    try {
      const geo = JSON.parse(p.boundaryJson);
      const coords: number[][] = geo.coordinates[0];
      const n = coords.length - 1; // exclude closing point
      const half = Math.floor(n / 2);

      // Sector A: first half of boundary + straight cut back
      const sectorACoords = [...coords.slice(0, half + 1), coords[0]];
      // Sector B: second half of boundary + straight cut back
      const sectorBCoords = [coords[0], ...coords.slice(half), coords[0]];

      const sectorA = buildSector(`${p.precinctNum}A`, p.precinctNum, sectorACoords);
      const sectorB = buildSector(`${p.precinctNum}B`, p.precinctNum, sectorBCoords);

      await insertSector(sectorA);
      await insertSector(sectorB);
    } catch {
      // skip malformed
    }
  }
}

function buildSector(sectorId: string, precinctNum: number, coords: number[][]): Sector {
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const c of coords) {
    if (c[1] < minLat) minLat = c[1];
    if (c[1] > maxLat) maxLat = c[1];
    if (c[0] < minLng) minLng = c[0];
    if (c[0] > maxLng) maxLng = c[0];
  }
  return {
    sectorId,
    precinctNum,
    boundaryJson: JSON.stringify({ type: 'Polygon', coordinates: [coords] }),
    boundingBoxJson: JSON.stringify([minLat, minLng, maxLat, maxLng]),
  };
}
