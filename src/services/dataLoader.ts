import { insertPrecinct } from '../db/repositories/precinctRepository';
import { insertLawCategory, insertLawEntry, updateCategoryCount, getLawStats } from '../db/repositories/lawRepository';
import { insertSquad, insertRdoSchedule } from '../db/repositories/calendarRepository';
import { setDataVersion, getDataVersion, isInitialLoadComplete } from '../db/repositories/syncRepository';
import { resetDatabase, getDatabase } from '../db/database';
import { fetchPrecinctDetailsFromGoogle } from './nycApi';
import type { Precinct, LawCategory, Squad, RdoSchedule, Borough } from '../models';

export type LoadProgress = {
  stage: string;
  progress: number;
};

/**
 * Seeds all initial data from APIs + bundled assets.
 * Precinct data comes live from Google Maps Places API.
 */
export async function performInitialDataLoad(
  onProgress?: (p: LoadProgress) => void
): Promise<void> {
  const isComplete = await isInitialLoadComplete();
  if (isComplete) {
    const stats = await getLawStats();
    if (stats.categories > 0 && stats.entries > 0) {
      await upgradePrecinctsIfNeeded(onProgress);
      return;
    }
    await resetDatabase();
  }

  try {
    onProgress?.({ stage: 'Setting up calendar data...', progress: 0.05 });
    await seedSquadsAndSchedules();

    onProgress?.({ stage: 'Loading law library...', progress: 0.15 });
    await seedLawLibrary();
    await setDataVersion('laws', '1.0.0');

    onProgress?.({ stage: 'Fetching precinct data from Google Maps...', progress: 0.30 });
    await seedPrecinctDataFromGoogle(onProgress);

    // Verify precincts loaded
    const db = await getDatabase();
    const count = await db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM precincts');
    if (!count || count.cnt === 0) {
      throw new Error('Google Maps API did not return any precinct data. Check your internet connection and API key.');
    }
    console.log(`[DataLoader] Loaded ${count.cnt} precincts from Google Maps`);

    await setDataVersion('precincts', PRECINCT_VERSION);

    onProgress?.({ stage: 'Complete!', progress: 1.0 });
  } catch (error) {
    console.error('Initial data load failed:', error);
    throw error;
  }
}

// ─── Version Management ──────────────────────────────────────────────────────

const PRECINCT_VERSION = '11.0.0';

async function upgradePrecinctsIfNeeded(
  onProgress?: (p: LoadProgress) => void
): Promise<void> {
  try {
    const precinctVer = await getDataVersion('precincts');
    if (!precinctVer || precinctVer.version < PRECINCT_VERSION) {
      onProgress?.({ stage: 'Updating precinct data from Google Maps...', progress: 0.2 });
      const db = await getDatabase();
      await db.runAsync('DELETE FROM sectors');
      await db.runAsync('DELETE FROM precincts');

      await seedPrecinctDataFromGoogle(onProgress);

      // Verify precincts were actually loaded
      const count = await db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM precincts');
      if (!count || count.cnt === 0) {
        throw new Error('No precincts loaded from Google Maps API');
      }

      await setDataVersion('precincts', PRECINCT_VERSION);
    }
  } catch (err) {
    console.warn('[DataLoader] Data upgrade failed, will retry on next launch:', err);
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

  const rotatingPattern = ['W','W','W','W','W','O','O','W','W','W','W','W','O','O','O'];
  const anchorDate = '2026-01-01';

  for (let i = 0; i < 5; i++) {
    const schedule: RdoSchedule = {
      scheduleId: i + 1,
      squadId: i + 1,
      patternType: 'rotating',
      cycleLength: 15,
      patternArray: rotatingPattern,
      anchorDate,
      squadOffset: i * 3,
    };
    await insertRdoSchedule(schedule);
  }

  const steadySchedule: RdoSchedule = {
    scheduleId: 6,
    squadId: 6,
    patternType: 'steady',
    cycleLength: 7,
    patternArray: ['O', 'W', 'W', 'W', 'W', 'W', 'O'],
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

  const sampleEntries = [
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
    { categoryId: 'admin_code', sectionNumber: '§ 10-125', title: 'Consumption of alcohol on streets prohibited', bodyText: 'It shall be unlawful for any person to drink or consume any alcoholic beverage, or possess, with intent to drink or consume, an open container containing an alcoholic beverage in any public place except at a block party, feast or similar function for which a permit has been obtained.' },
    { categoryId: 'admin_code', sectionNumber: '§ 10-131', title: 'Firearms - Permits', bodyText: 'It shall be unlawful for any person to have in his or her possession any pistol or revolver without a written permit therefor, issued to him or her by the police commissioner or the licensing officer of the city.' },
    { categoryId: 'admin_code', sectionNumber: '§ 10-133', title: 'Firearms - Rifles and shotguns', bodyText: 'It shall be unlawful for any person to have in his or her possession a rifle or shotgun which has not been registered and for which a certificate of registration and a rifle or shotgun permit have not been issued.' },
    { categoryId: 'admin_code', sectionNumber: '§ 10-203', title: 'Unlawful cutting of trees', bodyText: 'It shall be unlawful for any person, without permission of the commissioner, to remove, injure or destroy any tree on a city street or park.' },
    { categoryId: 'admin_code', sectionNumber: '§ 16-118', title: 'Littering prohibited', bodyText: 'No person shall litter, sweep, throw or cast any ashes, garbage, paper, dust or other material in or upon any street or public place. Violation is punishable by a civil penalty of not less than fifty dollars nor more than two hundred fifty dollars for the first violation.' },
    { categoryId: 'admin_code', sectionNumber: '§ 24-218', title: 'Noise control', bodyText: 'No person shall make, continue or cause or permit to be made or continued any unreasonable noise. Unreasonable noise shall include but shall not be limited to sound, attributable to any device, that exceeds the following prohibited noise levels.' },
    { categoryId: 'traffic_rules', sectionNumber: '§ 4-08(a)', title: 'Parking, standing, stopping rules', bodyText: 'No person shall park, stop, or stand a vehicle in any of the following places, unless otherwise indicated by posted signs, markings, or other traffic control devices: in a bus stop, within a crosswalk, within an intersection, on a sidewalk.' },
    { categoryId: 'traffic_rules', sectionNumber: '§ 4-08(e)', title: 'Double parking', bodyText: 'No person shall stand or park a vehicle in a roadway adjacent to a vehicle stopped, standing, or parked at the curb or edge of a roadway (double parking). Standing in violation of this rule is punishable by a monetary fine.' },
    { categoryId: 'traffic_rules', sectionNumber: '§ 4-08(f)', title: 'Parking in front of private driveways', bodyText: 'No person shall park a vehicle in front of or within five feet of a private driveway or in front of a public or private entrance or exit.' },
    { categoryId: 'traffic_rules', sectionNumber: '§ 4-11(a)', title: 'Commercial vehicle restrictions', bodyText: 'No person shall operate a commercial vehicle upon any street in a residential district at any time, unless such commercial vehicle is making or has made a delivery or pick-up at such street.' },
    { categoryId: 'traffic_rules', sectionNumber: '§ 4-12(p)', title: 'Bicycles', bodyText: 'Bicyclists must obey all traffic signals and signs. Every person operating a bicycle upon a roadway shall ride in the direction of traffic.' },
  ];

  for (const entry of sampleEntries) {
    await insertLawEntry(entry);
  }

  for (const cat of categories) {
    await updateCategoryCount(cat.categoryId);
  }
}

/**
 * Force refresh precinct data from Google Maps (includes opening hours).
 * Can be called from UI to re-fetch without clearing the entire DB.
 */
export async function refreshPrecinctData(
  onProgress?: (p: LoadProgress) => void
): Promise<void> {
  const db = await getDatabase();
  onProgress?.({ stage: 'Clearing old precinct data...', progress: 0.1 });
  await db.runAsync('DELETE FROM sectors');
  await db.runAsync('DELETE FROM precincts');

  await seedPrecinctDataFromGoogle(onProgress);

  const count = await db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM precincts');
  if (!count || count.cnt === 0) {
    throw new Error('No precincts loaded from Google Maps API');
  }

  await setDataVersion('precincts', PRECINCT_VERSION);
  onProgress?.({ stage: 'Complete!', progress: 1.0 });
}

// ─── Precinct Data from Google Maps API ──────────────────────────────────────

async function seedPrecinctDataFromGoogle(
  onProgress?: (p: LoadProgress) => void
): Promise<void> {
  onProgress?.({ stage: 'Fetching precinct details from Google Maps...', progress: 0.40 });
  const googleData = await fetchPrecinctDetailsFromGoogle();

  onProgress?.({ stage: 'Saving precinct data...', progress: 0.75 });

  for (const [precinctNum, info] of googleData) {
    const precinct: Precinct = {
      precinctNum,
      name: info.name || fallbackName(precinctNum),
      address: info.address || '',
      phone: info.phone || '',
      borough: info.borough || fallbackBorough(precinctNum),
      boundaryJson: '{}',
      centroidLat: info.latitude,
      centroidLng: info.longitude,
      boundingBoxJson: '[]',
      openingHoursJson: JSON.stringify(info.openingHours || []),
    };

    await insertPrecinct(precinct);
  }
}

function fallbackName(precinctNum: number): string {
  const suffix = getOrdinalSuffix(precinctNum);
  return `${precinctNum}${suffix} Precinct`;
}

function getOrdinalSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function fallbackBorough(num: number): Borough {
  if (num < 40) return 'Manhattan';
  if (num < 60) return 'Bronx';
  if (num < 100) return 'Brooklyn';
  if (num < 120) return 'Queens';
  return 'Staten Island';
}

