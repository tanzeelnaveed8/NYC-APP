import { insertPrecinct, insertSector } from '../db/repositories/precinctRepository';
import { insertLawCategory, insertLawEntry, updateCategoryCount, getLawStats } from '../db/repositories/lawRepository';
import { insertSquad, insertRdoSchedule } from '../db/repositories/calendarRepository';
import { setDataVersion, isInitialLoadComplete } from '../db/repositories/syncRepository';
import { resetDatabase } from '../db/database';
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
      return;
    }
    // Data versions exist but tables are empty - reset and reload
    // Data versions exist but tables empty, resetting
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
    await setDataVersion('precincts', '1.0.0');

    // Stage 4: Seed sector boundaries
    onProgress?.({ stage: 'Loading sector boundaries...', progress: 0.7 });
    await seedSectorData();
    await setDataVersion('sectors', '1.0.0');

    onProgress?.({ stage: 'Complete!', progress: 1.0 });
  } catch (error) {
    console.error('Initial data load failed:', error);
    throw error;
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
    { precinctNum: 1, name: '1st Precinct', address: '16 Ericsson Place', phone: '(212) 334-0611', borough: 'Manhattan', boundaryJson: '{"type":"Polygon","coordinates":[[[-74.013,40.709],[-74.009,40.715],[-74.002,40.716],[-73.998,40.711],[-74.002,40.707],[-74.008,40.706],[-74.013,40.709]]]}', centroidLat: 40.711, centroidLng: -74.006, boundingBoxJson: '[40.706,-74.013,40.716,-73.998]' },
    { precinctNum: 5, name: '5th Precinct', address: '19 Elizabeth Street', phone: '(212) 334-0711', borough: 'Manhattan', boundaryJson: '{"type":"Polygon","coordinates":[[[-73.999,40.716],[-73.995,40.721],[-73.990,40.720],[-73.992,40.714],[-73.999,40.716]]]}', centroidLat: 40.718, centroidLng: -73.994, boundingBoxJson: '[40.714,-73.999,40.721,-73.990]' },
    { precinctNum: 6, name: '6th Precinct', address: '233 West 10th Street', phone: '(212) 741-4811', borough: 'Manhattan', boundaryJson: '{"type":"Polygon","coordinates":[[[-74.007,40.730],[-74.001,40.737],[-73.996,40.735],[-73.999,40.728],[-74.007,40.730]]]}', centroidLat: 40.732, centroidLng: -74.001, boundingBoxJson: '[40.728,-74.007,40.737,-73.996]' },
    { precinctNum: 7, name: '7th Precinct', address: '19 1/2 Pitt Street', phone: '(212) 477-7311', borough: 'Manhattan', boundaryJson: '{"type":"Polygon","coordinates":[[[-73.990,40.714],[-73.985,40.720],[-73.978,40.718],[-73.980,40.712],[-73.990,40.714]]]}', centroidLat: 40.716, centroidLng: -73.983, boundingBoxJson: '[40.712,-73.990,40.720,-73.978]' },
    { precinctNum: 9, name: '9th Precinct', address: '321 East 5th Street', phone: '(212) 477-7811', borough: 'Manhattan', boundaryJson: '{"type":"Polygon","coordinates":[[[-73.992,40.722],[-73.986,40.730],[-73.979,40.728],[-73.982,40.720],[-73.992,40.722]]]}', centroidLat: 40.725, centroidLng: -73.985, boundingBoxJson: '[40.720,-73.992,40.730,-73.979]' },
    { precinctNum: 10, name: '10th Precinct', address: '230 West 20th Street', phone: '(212) 741-8211', borough: 'Manhattan', boundaryJson: '{"type":"Polygon","coordinates":[[[-74.005,40.740],[-73.998,40.748],[-73.993,40.746],[-73.997,40.738],[-74.005,40.740]]]}', centroidLat: 40.743, centroidLng: -73.998, boundingBoxJson: '[40.738,-74.005,40.748,-73.993]' },
    { precinctNum: 13, name: '13th Precinct', address: '230 East 21st Street', phone: '(212) 477-7411', borough: 'Manhattan', boundaryJson: '{"type":"Polygon","coordinates":[[[-73.990,40.735],[-73.983,40.742],[-73.977,40.740],[-73.980,40.733],[-73.990,40.735]]]}', centroidLat: 40.738, centroidLng: -73.983, boundingBoxJson: '[40.733,-73.990,40.742,-73.977]' },
    { precinctNum: 14, name: '14th Precinct (Midtown South)', address: '357 West 35th Street', phone: '(212) 239-9811', borough: 'Manhattan', boundaryJson: '{"type":"Polygon","coordinates":[[[-74.000,40.750],[-73.993,40.758],[-73.985,40.755],[-73.990,40.748],[-74.000,40.750]]]}', centroidLat: 40.753, centroidLng: -73.992, boundingBoxJson: '[40.748,-74.000,40.758,-73.985]' },
    { precinctNum: 17, name: '17th Precinct', address: '167 East 51st Street', phone: '(212) 826-3211', borough: 'Manhattan', boundaryJson: '{"type":"Polygon","coordinates":[[[-73.978,40.755],[-73.971,40.762],[-73.965,40.760],[-73.969,40.753],[-73.978,40.755]]]}', centroidLat: 40.758, centroidLng: -73.971, boundingBoxJson: '[40.753,-73.978,40.762,-73.965]' },
    { precinctNum: 18, name: '18th Precinct (Midtown North)', address: '306 West 54th Street', phone: '(212) 767-8400', borough: 'Manhattan', boundaryJson: '{"type":"Polygon","coordinates":[[[-73.993,40.760],[-73.985,40.768],[-73.978,40.766],[-73.983,40.758],[-73.993,40.760]]]}', centroidLat: 40.763, centroidLng: -73.985, boundingBoxJson: '[40.758,-73.993,40.768,-73.978]' },
    { precinctNum: 19, name: '19th Precinct', address: '153 East 67th Street', phone: '(212) 452-0600', borough: 'Manhattan', boundaryJson: '{"type":"Polygon","coordinates":[[[-73.975,40.765],[-73.968,40.775],[-73.960,40.773],[-73.964,40.763],[-73.975,40.765]]]}', centroidLat: 40.769, centroidLng: -73.967, boundingBoxJson: '[40.763,-73.975,40.775,-73.960]' },
    { precinctNum: 20, name: '20th Precinct', address: '120 West 82nd Street', phone: '(212) 580-6411', borough: 'Manhattan', boundaryJson: '{"type":"Polygon","coordinates":[[[-73.982,40.778],[-73.975,40.788],[-73.968,40.786],[-73.972,40.776],[-73.982,40.778]]]}', centroidLat: 40.782, centroidLng: -73.974, boundingBoxJson: '[40.776,-73.982,40.788,-73.968]' },
    // Brooklyn
    { precinctNum: 60, name: '60th Precinct', address: '2951 West 8th Street', phone: '(718) 946-3311', borough: 'Brooklyn', boundaryJson: '{"type":"Polygon","coordinates":[[[-73.990,40.575],[-73.978,40.582],[-73.968,40.578],[-73.975,40.570],[-73.990,40.575]]]}', centroidLat: 40.576, centroidLng: -73.978, boundingBoxJson: '[40.570,-73.990,40.582,-73.968]' },
    { precinctNum: 61, name: '61st Precinct', address: '2575 Coney Island Avenue', phone: '(718) 627-6611', borough: 'Brooklyn', boundaryJson: '{"type":"Polygon","coordinates":[[[-73.968,40.578],[-73.955,40.590],[-73.945,40.585],[-73.955,40.573],[-73.968,40.578]]]}', centroidLat: 40.582, centroidLng: -73.956, boundingBoxJson: '[40.573,-73.968,40.590,-73.945]' },
    { precinctNum: 66, name: '66th Precinct', address: '5822 16th Avenue', phone: '(718) 851-5611', borough: 'Brooklyn', boundaryJson: '{"type":"Polygon","coordinates":[[[-73.998,40.625],[-73.985,40.635],[-73.975,40.630],[-73.985,40.620],[-73.998,40.625]]]}', centroidLat: 40.628, centroidLng: -73.986, boundingBoxJson: '[40.620,-73.998,40.635,-73.975]' },
    // Bronx
    { precinctNum: 40, name: '40th Precinct', address: '257 Alexander Avenue', phone: '(718) 402-2270', borough: 'Bronx', boundaryJson: '{"type":"Polygon","coordinates":[[[-73.925,40.810],[-73.915,40.820],[-73.905,40.815],[-73.912,40.805],[-73.925,40.810]]]}', centroidLat: 40.813, centroidLng: -73.914, boundingBoxJson: '[40.805,-73.925,40.820,-73.905]' },
    { precinctNum: 41, name: '41st Precinct', address: '1035 Longwood Avenue', phone: '(718) 542-4771', borough: 'Bronx', boundaryJson: '{"type":"Polygon","coordinates":[[[-73.905,40.815],[-73.893,40.828],[-73.883,40.823],[-73.892,40.810],[-73.905,40.815]]]}', centroidLat: 40.819, centroidLng: -73.893, boundingBoxJson: '[40.810,-73.905,40.828,-73.883]' },
    { precinctNum: 42, name: '42nd Precinct', address: '830 Washington Avenue', phone: '(718) 402-3887', borough: 'Bronx', boundaryJson: '{"type":"Polygon","coordinates":[[[-73.912,40.825],[-73.900,40.838],[-73.890,40.833],[-73.900,40.820],[-73.912,40.825]]]}', centroidLat: 40.829, centroidLng: -73.901, boundingBoxJson: '[40.820,-73.912,40.838,-73.890]' },
    // Queens
    { precinctNum: 100, name: '100th Precinct', address: '92-24 Rockaway Beach Blvd', phone: '(718) 318-4200', borough: 'Queens', boundaryJson: '{"type":"Polygon","coordinates":[[[-73.830,40.580],[-73.815,40.590],[-73.805,40.585],[-73.815,40.575],[-73.830,40.580]]]}', centroidLat: 40.583, centroidLng: -73.816, boundingBoxJson: '[40.575,-73.830,40.590,-73.805]' },
    { precinctNum: 101, name: '101st Precinct', address: '16-12 Mott Avenue', phone: '(718) 868-3400', borough: 'Queens', boundaryJson: '{"type":"Polygon","coordinates":[[[-73.760,40.600],[-73.745,40.612],[-73.735,40.607],[-73.745,40.595],[-73.760,40.600]]]}', centroidLat: 40.604, centroidLng: -73.746, boundingBoxJson: '[40.595,-73.760,40.612,-73.735]' },
    { precinctNum: 102, name: '102nd Precinct', address: '87-34 118th Street', phone: '(718) 805-3200', borough: 'Queens', boundaryJson: '{"type":"Polygon","coordinates":[[[-73.835,40.690],[-73.820,40.700],[-73.810,40.695],[-73.820,40.685],[-73.835,40.690]]]}', centroidLat: 40.693, centroidLng: -73.821, boundingBoxJson: '[40.685,-73.835,40.700,-73.810]' },
    // Staten Island
    { precinctNum: 120, name: '120th Precinct', address: '78 Richmond Terrace', phone: '(718) 876-8500', borough: 'Staten Island', boundaryJson: '{"type":"Polygon","coordinates":[[[-74.090,40.638],[-74.075,40.650],[-74.060,40.645],[-74.070,40.632],[-74.090,40.638]]]}', centroidLat: 40.641, centroidLng: -74.074, boundingBoxJson: '[40.632,-74.090,40.650,-74.060]' },
    { precinctNum: 122, name: '122nd Precinct', address: '2320 Hylan Boulevard', phone: '(718) 667-2211', borough: 'Staten Island', boundaryJson: '{"type":"Polygon","coordinates":[[[-74.120,40.570],[-74.100,40.585],[-74.085,40.578],[-74.100,40.563],[-74.120,40.570]]]}', centroidLat: 40.574, centroidLng: -74.101, boundingBoxJson: '[40.563,-74.120,40.585,-74.085]' },
  ];

  for (const p of precincts) {
    await insertPrecinct(p);
  }
}

async function seedSectorData(): Promise<void> {
  // Simplified sector data for key precincts
  const sectors: Sector[] = [
    { sectorId: '1A', precinctNum: 1, boundaryJson: '{"type":"Polygon","coordinates":[[[-74.013,40.709],[-74.009,40.715],[-74.006,40.713],[-74.008,40.708],[-74.013,40.709]]]}', boundingBoxJson: '[40.708,-74.013,40.715,-74.006]' },
    { sectorId: '1B', precinctNum: 1, boundaryJson: '{"type":"Polygon","coordinates":[[[-74.006,40.713],[-74.002,40.716],[-73.998,40.711],[-74.002,40.709],[-74.006,40.713]]]}', boundingBoxJson: '[40.709,-74.006,40.716,-73.998]' },
    { sectorId: '5A', precinctNum: 5, boundaryJson: '{"type":"Polygon","coordinates":[[[-73.999,40.716],[-73.995,40.721],[-73.993,40.718],[-73.996,40.715],[-73.999,40.716]]]}', boundingBoxJson: '[40.715,-73.999,40.721,-73.993]' },
    { sectorId: '14A', precinctNum: 14, boundaryJson: '{"type":"Polygon","coordinates":[[[-74.000,40.750],[-73.993,40.758],[-73.990,40.753],[-73.995,40.749],[-74.000,40.750]]]}', boundingBoxJson: '[40.749,-74.000,40.758,-73.990]' },
    { sectorId: '40A', precinctNum: 40, boundaryJson: '{"type":"Polygon","coordinates":[[[-73.925,40.810],[-73.915,40.820],[-73.912,40.815],[-73.918,40.808],[-73.925,40.810]]]}', boundingBoxJson: '[40.808,-73.925,40.820,-73.912]' },
    { sectorId: '60A', precinctNum: 60, boundaryJson: '{"type":"Polygon","coordinates":[[[-73.990,40.575],[-73.978,40.582],[-73.976,40.577],[-73.983,40.572],[-73.990,40.575]]]}', boundingBoxJson: '[40.572,-73.990,40.582,-73.976]' },
  ];

  for (const s of sectors) {
    await insertSector(s);
  }
}
