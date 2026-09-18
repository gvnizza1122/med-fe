/**
 * Kamus Deskripsi Kode ICD-10 (WHO 2010) — Standar BPJS
 *
 * Kumpulan deskripsi kode diagnosis ICD-10 yang umum dipakai di klaim
 * BPJS Kesehatan, disusun per bab ICD-10 (infeksi, pernapasan, jantung,
 * pencernaan, cedera, dll). Setiap deskripsi memakai format:
 *   "<Deskripsi resmi bahasa Inggris> (<Terjemahan/istilah awam Indonesia>)"
 *
 * Catatan cakupan:
 * - Berisi ratusan kode yang paling sering muncul di dokumen medis/klaim,
 *   bukan seluruh ~14.000 kode ICD-10. Kode yang belum terdaftar akan
 *   mengembalikan fallback "—" dari getICD10Description().
 * - Hanya ICD-10 WHO 2010 (dipakai BPJS untuk DIAGLIST). Kode prosedur
 *   ICD-9-CM (PROCLIST) tidak dicakup di sini — lihat ICD9CM_PROCEDURES
 *   pada generateCodingExplanation.ts.
 * - Silakan tambahkan entri baru sesuai kebutuhan; struktur data sengaja
 *   dibuat flat (Record<string, string>) agar mudah diperluas.
 */

export const ICD10_DESCRIPTIONS: Record<string, string> = {
  // ─── A00–B99: Penyakit Infeksi dan Parasit ─────────────────────────────
  'A00.9': 'Cholera, unspecified (Kolera, tidak spesifik)',
  'A01.0': 'Typhoid fever (Demam tifoid)',
  'A02.0': 'Salmonella enteritis (Enteritis Salmonella)',
  'A03.9': 'Shigellosis, unspecified (Disentri basiler, tidak spesifik)',
  'A04.7': "Enterocolitis due to Clostridium difficile (Enterokolitis akibat Clostridium difficile)",
  'A05.9': 'Bacterial foodborne intoxication, unspecified (Keracunan makanan akibat bakteri)',
  'A06.0': 'Acute amoebic dysentery (Disentri amuba akut)',
  'A08.0': 'Rotaviral enteritis (Enteritis rotavirus)',
  'A08.4': 'Viral intestinal infection, unspecified (Infeksi usus virus, tidak spesifik)',
  'A09': 'Infectious gastroenteritis and colitis, unspecified (Gastroenteritis dan kolitis infeksi)',
  'A09.9': 'Gastroenteritis and colitis of unspecified origin (Gastroenteritis dan kolitis tidak spesifik penyebabnya)',
  'A15.0': 'Tuberculosis of lung, confirmed by sputum microscopy (TB paru, terkonfirmasi mikroskopik dahak)',
  'A15.9': 'Respiratory tuberculosis unspecified, confirmed bacteriologically and histologically (TB pernapasan tidak spesifik, terkonfirmasi)',
  'A16.2': 'Tuberculosis of lung, without mention of bacteriological or histological confirmation (TB paru tanpa konfirmasi bakteriologis)',
  'A17.0': 'Tuberculous meningitis (Meningitis tuberkulosis / TB selaput otak)',
  'A17.9': 'Tuberculosis of nervous system, unspecified (TB sistem saraf, tidak spesifik)',
  'A18.0': 'Tuberculosis of bones and joints (TB tulang dan sendi)',
  'A19.9': 'Miliary tuberculosis, unspecified (TB milier, tidak spesifik)',
  'A27.9': 'Leptospirosis, unspecified (Leptospirosis, tidak spesifik)',
  'A30.9': 'Leprosy, unspecified (Kusta, tidak spesifik)',
  'A33': 'Tetanus neonatorum (Tetanus pada bayi baru lahir)',
  'A35': 'Other tetanus (Tetanus lainnya)',
  'A36.9': 'Diphtheria, unspecified (Difteri, tidak spesifik)',
  'A37.90': 'Whooping cough, unspecified species, without pneumonia (Pertusis / batuk rejan)',
  'A39.9': 'Meningococcal infection, unspecified (Infeksi meningokokus, tidak spesifik)',
  'A40.9': 'Streptococcal sepsis, unspecified (Sepsis streptokokus, tidak spesifik)',
  'A41.9': 'Sepsis, unspecified (Sepsis, organisme tidak spesifik)',
  'A46': 'Erysipelas (Erisipelas)',
  'A49.9': 'Bacterial infection, unspecified (Infeksi bakteri, tidak spesifik)',
  'A54.9': 'Gonococcal infection, unspecified (Infeksi gonokokus, tidak spesifik)',
  'A56.0': 'Chlamydial infection of lower genitourinary tract (Infeksi klamidia saluran genitourinari bawah)',
  'A59.0': 'Urogenital trichomoniasis (Trikomoniasis urogenital)',
  'A60.0': 'Herpesviral infection of genitalia and urogenital tract (Herpes genital)',
  'A63.0': 'Anogenital (venereal) warts (Kutil kelamin/anogenital)',
  'A75.9': 'Typhus fever, unspecified (Tifus, tidak spesifik)',
  'A90': 'Dengue fever [classical dengue] (Demam dengue)',
  'A91': 'Dengue haemorrhagic fever (Demam berdarah dengue / DBD)',
  'A92.0': 'Chikungunya virus disease (Penyakit virus Chikungunya)',
  'B00.9': 'Herpesviral infection, unspecified (Infeksi virus herpes, tidak spesifik)',
  'B01.9': 'Varicella without complication (Cacar air tanpa komplikasi)',
  'B02.9': 'Zoster without complication (Herpes zoster / cacar ular tanpa komplikasi)',
  'B05.9': 'Measles without complication (Campak tanpa komplikasi)',
  'B06.9': 'Rubella without complication (Campak Jerman tanpa komplikasi)',
  'B15.9': 'Hepatitis A without hepatic coma (Hepatitis A tanpa koma hepatik)',
  'B16.9': 'Acute hepatitis B without delta-agent and without hepatic coma (Hepatitis B akut)',
  'B17.1': 'Acute hepatitis C (Hepatitis C akut)',
  'B18.1': 'Chronic viral hepatitis B without delta-agent (Hepatitis B kronis)',
  'B18.2': 'Chronic viral hepatitis C (Hepatitis C kronis)',
  'B19.9': 'Unspecified viral hepatitis without hepatic coma (Hepatitis virus, tidak spesifik)',
  'B20': 'HIV disease resulting in infectious and parasitic diseases (Penyakit HIV dengan infeksi oportunistik)',
  'B24': 'Unspecified human immunodeficiency virus [HIV] disease (Penyakit HIV, tidak spesifik)',
  'B27.9': 'Infectious mononucleosis, unspecified (Mononukleosis infeksiosa)',
  'B34.9': 'Viral infection, unspecified (Infeksi virus, tidak spesifik)',
  'B37.0': 'Candidal stomatitis (Kandidiasis mulut / oral thrush)',
  'B37.3': 'Candidiasis of vulva and vagina (Kandidiasis vulva dan vagina)',
  'B37.9': 'Candidiasis, unspecified (Kandidiasis, tidak spesifik)',
  'B50.9': 'Plasmodium falciparum malaria, unspecified (Malaria falciparum, tidak spesifik)',
  'B51.9': 'Plasmodium vivax malaria without complication (Malaria vivax tanpa komplikasi)',
  'B54': 'Unspecified malaria (Malaria, tidak spesifik)',
  'B77.9': 'Ascariasis, unspecified (Askariasis / cacingan)',
  'B82.9': 'Intestinal parasitism, unspecified (Parasit usus, tidak spesifik)',

  // ─── C00–D48: Neoplasma ─────────────────────────────────────────────────
  'C16.9': 'Malignant neoplasm of stomach, unspecified (Kanker lambung, tidak spesifik)',
  'C18.9': 'Malignant neoplasm of colon, unspecified (Kanker usus besar, tidak spesifik)',
  'C22.0': 'Liver cell carcinoma (Karsinoma sel hati)',
  'C25.9': 'Malignant neoplasm of pancreas, unspecified (Kanker pankreas, tidak spesifik)',
  'C34.9': 'Malignant neoplasm of bronchus or lung, unspecified (Kanker paru, tidak spesifik)',
  'C50.9': 'Malignant neoplasm of breast, unspecified (Kanker payudara, tidak spesifik)',
  'C53.9': 'Malignant neoplasm of cervix uteri, unspecified (Kanker leher rahim, tidak spesifik)',
  'C61': 'Malignant neoplasm of prostate (Kanker prostat)',
  'C67.9': 'Malignant neoplasm of bladder, unspecified (Kanker kandung kemih, tidak spesifik)',
  'C71.9': 'Malignant neoplasm of brain, unspecified (Kanker otak, tidak spesifik)',
  'C73': 'Malignant neoplasm of thyroid gland (Kanker kelenjar tiroid)',
  'C77.9': 'Secondary malignant neoplasm of lymph node, unspecified (Metastasis ke kelenjar getah bening)',
  'C80.9': 'Malignant neoplasm, unspecified (Keganasan, tidak spesifik)',
  'D12.6': 'Benign neoplasm of colon, unspecified (Tumor jinak usus besar)',
  'D24': 'Benign neoplasm of breast (Tumor jinak payudara)',
  'D25.9': 'Leiomyoma of uterus, unspecified (Mioma uteri, tidak spesifik)',

  // ─── D50–D89: Darah dan Organ Pembentuk Darah ──────────────────────────
  'D50.9': 'Iron deficiency anaemia, unspecified (Anemia defisiensi besi)',
  'D64.9': 'Anaemia, unspecified (Anemia, tidak spesifik)',
  'D69.6': 'Thrombocytopenia, unspecified (Trombositopenia, tidak spesifik)',
  'D70': 'Agranulocytosis (Agranulositosis)',

  // ─── E00–E90: Endokrin, Nutrisi, Metabolik ─────────────────────────────
  'E03.9': 'Hypothyroidism, unspecified (Hipotiroidisme, tidak spesifik)',
  'E05.9': 'Thyrotoxicosis, unspecified (Hipertiroidisme, tidak spesifik)',
  'E10.9': 'Type 1 diabetes mellitus without complications (DM tipe 1 tanpa komplikasi)',
  'E11.2': 'Type 2 diabetes mellitus with renal complications (DM tipe 2 dengan komplikasi ginjal)',
  'E11.3': 'Type 2 diabetes mellitus with ophthalmic complications (DM tipe 2 dengan komplikasi mata)',
  'E11.5': 'Type 2 diabetes mellitus with peripheral circulatory complications (DM tipe 2 dengan komplikasi pembuluh darah tepi)',
  'E11.9': 'Type 2 diabetes mellitus without complications (DM tipe 2 tanpa komplikasi)',
  'E14.9': 'Unspecified diabetes mellitus without complications (DM tidak spesifik tanpa komplikasi)',
  'E16.2': 'Hypoglycaemia, unspecified (Hipoglikemia / gula darah rendah)',
  'E66.9': 'Obesity, unspecified (Obesitas, tidak spesifik)',
  'E78.0': 'Pure hypercholesterolaemia (Kolesterol tinggi murni)',
  'E78.5': 'Hyperlipidaemia, unspecified (Hiperlipidemia, tidak spesifik)',
  'E86': 'Volume depletion (Dehidrasi / kekurangan cairan tubuh)',
  'E87.1': 'Hypo-osmolality and hyponatraemia (Hiponatremia)',
  'E87.5': 'Hyperkalaemia (Kadar kalium darah tinggi)',
  'E87.6': 'Hypokalaemia (Kadar kalium darah rendah)',

  // ─── F00–F99: Gangguan Mental dan Perilaku ─────────────────────────────
  'F03': 'Unspecified dementia (Demensia, tidak spesifik)',
  'F10.9': 'Mental and behavioural disorder due to use of alcohol, unspecified (Gangguan mental akibat alkohol)',
  'F17.2': 'Mental and behavioural disorder due to use of tobacco, dependence syndrome (Ketergantungan nikotin)',
  'F20.9': 'Schizophrenia, unspecified (Skizofrenia, tidak spesifik)',
  'F31.9': 'Bipolar affective disorder, unspecified (Gangguan bipolar, tidak spesifik)',
  'F32.9': 'Depressive episode, unspecified (Episode depresi, tidak spesifik)',
  'F33.9': 'Recurrent depressive disorder, unspecified (Gangguan depresi berulang)',
  'F41.0': 'Panic disorder [episodic paroxysmal anxiety] (Gangguan panik)',
  'F41.1': 'Generalized anxiety disorder (Gangguan cemas menyeluruh)',
  'F41.9': 'Anxiety disorder, unspecified (Gangguan cemas, tidak spesifik)',
  'F45.9': 'Somatoform disorder, unspecified (Gangguan somatoform)',
  'F50.9': 'Eating disorder, unspecified (Gangguan makan, tidak spesifik)',
  'F84.0': 'Childhood autism (Autisme masa kanak)',

  // ─── G00–G99: Penyakit Sistem Saraf ─────────────────────────────────────
  'G00.9': 'Bacterial meningitis, unspecified (Meningitis bakteri, tidak spesifik)',
  'G03.9': 'Meningitis, unspecified (Meningitis, tidak spesifik)',
  'G40.9': 'Epilepsy, unspecified (Epilepsi, tidak spesifik)',
  'G43.9': 'Migraine, unspecified (Migrain, tidak spesifik)',
  'G45.9': 'Transient cerebral ischaemic attack, unspecified (Serangan iskemik otak sesaat / TIA)',
  'G47.0': 'Disorders of initiating and maintaining sleep [insomnias] (Insomnia)',
  'G50.0': 'Trigeminal neuralgia (Neuralgia trigeminal)',
  'G56.0': 'Carpal tunnel syndrome (Sindrom terowongan karpal)',
  'G62.9': 'Polyneuropathy, unspecified (Polineuropati, tidak spesifik)',
  'G80.9': 'Cerebral palsy, unspecified (Palsi serebral, tidak spesifik)',
  'G91.9': 'Hydrocephalus, unspecified (Hidrosefalus, tidak spesifik)',

  // ─── H00–H59: Penyakit Mata dan Adneksa ─────────────────────────────────
  'H10.9': 'Conjunctivitis, unspecified (Konjungtivitis, tidak spesifik)',
  'H16.9': 'Keratitis, unspecified (Keratitis, tidak spesifik)',
  'H25.9': 'Senile cataract, unspecified (Katarak senilis, tidak spesifik)',
  'H26.9': 'Cataract, unspecified (Katarak, tidak spesifik)',
  'H40.9': 'Glaucoma, unspecified (Glaukoma, tidak spesifik)',
  'H52.1': 'Myopia (Rabun jauh)',
  'H52.4': 'Presbyopia (Presbiopi / rabun tua)',

  // ─── H60–H95: Penyakit Telinga dan Prosesus Mastoideus ─────────────────
  'H60.9': 'Otitis externa, unspecified (Otitis eksterna, tidak spesifik)',
  'H65.9': 'Nonsuppurative otitis media, unspecified (Otitis media non-supuratif)',
  'H66.9': 'Otitis media, unspecified (Otitis media, tidak spesifik)',
  'H81.1': 'Benign paroxysmal vertigo (Vertigo posisi paroksismal jinak)',
  'H90.3': 'Sensorineural hearing loss, bilateral (Gangguan pendengaran sensorineural bilateral)',
  'H91.9': 'Hearing loss, unspecified (Gangguan pendengaran, tidak spesifik)',

  // ─── I00–I99: Penyakit Sistem Sirkulasi (Jantung & Pembuluh Darah) ─────
  'I05.9': 'Rheumatic mitral valve disease, unspecified (Penyakit katup mitral reumatik)',
  'I10': 'Essential (primary) hypertension (Hipertensi esensial)',
  'I11.0': 'Hypertensive heart disease with (congestive) heart failure (Penyakit jantung hipertensi dengan gagal jantung)',
  'I11.9': 'Hypertensive heart disease without (congestive) heart failure (Penyakit jantung hipertensi tanpa gagal jantung)',
  'I12.9': 'Hypertensive chronic kidney disease with stage 1-4 chronic kidney disease (Penyakit ginjal kronis hipertensif)',
  'I15.9': 'Secondary hypertension, unspecified (Hipertensi sekunder, tidak spesifik)',
  'I20.9': 'Angina pectoris, unspecified (Angina pektoris, tidak spesifik)',
  'I21.9': 'Acute myocardial infarction, unspecified (Infark miokard akut / serangan jantung)',
  'I25.1': 'Atherosclerotic heart disease (Penyakit jantung aterosklerotik)',
  'I25.9': 'Chronic ischaemic heart disease, unspecified (Penyakit jantung iskemik kronis)',
  'I26.9': 'Pulmonary embolism without mention of acute cor pulmonale (Emboli paru)',
  'I27.9': 'Pulmonary heart disease, unspecified (Penyakit jantung paru, tidak spesifik)',
  'I48': 'Atrial fibrillation and flutter (Fibrilasi dan flutter atrium)',
  'I50.0': 'Congestive heart failure (Gagal jantung kongestif)',
  'I50.9': 'Heart failure, unspecified (Gagal jantung, tidak spesifik)',
  'I51.9': 'Heart disease, unspecified (Penyakit jantung, tidak spesifik)',
  'I61.9': 'Intracerebral haemorrhage, unspecified (Perdarahan intraserebral)',
  'I63.9': 'Cerebral infarction, unspecified (Infark serebral / stroke iskemik)',
  'I64': 'Stroke, not specified as haemorrhage or infarction (Stroke, tidak spesifik)',
  'I67.9': 'Cerebrovascular disease, unspecified (Penyakit serebrovaskular, tidak spesifik)',
  'I69.4': 'Sequelae of stroke, not specified as haemorrhage or infarction (Gejala sisa stroke)',
  'I70.9': 'Generalized and unspecified atherosclerosis (Aterosklerosis umum)',
  'I73.9': 'Peripheral vascular disease, unspecified (Penyakit vaskular perifer, tidak spesifik)',
  'I80.2': 'Phlebitis and thrombophlebitis of other deep vessels of lower extremities (Trombosis vena dalam / DVT)',
  'I83.9': 'Varicose veins of lower extremities without ulcer or inflammation (Varises tungkai)',
  'I84.9': 'Haemorrhoids without complication (Wasir / ambeien tanpa komplikasi)',
  'I95.9': 'Hypotension, unspecified (Hipotensi, tidak spesifik)',

  // ─── J00–J99: Penyakit Sistem Pernapasan ────────────────────────────────
  'J00': 'Acute nasopharyngitis [common cold] (Nasofaringitis akut / pilek)',
  'J01.9': 'Acute sinusitis, unspecified (Sinusitis akut, tidak spesifik)',
  'J02.9': 'Acute pharyngitis, unspecified (Faringitis akut, tidak spesifik)',
  'J03.9': 'Acute tonsillitis, unspecified (Tonsilitis akut, tidak spesifik)',
  'J04.0': 'Acute laryngitis (Laringitis akut)',
  'J04.2': 'Acute laryngotracheitis (Laringotrakeitis akut)',
  'J06.9': 'Acute upper respiratory infection, unspecified (ISPA atas, tidak spesifik)',
  'J09': 'Influenza due to identified zoonotic or pandemic influenza virus (Influenza akibat virus zoonotik/pandemik)',
  'J10.1': 'Influenza with other respiratory manifestations, virus identified (Influenza dengan manifestasi pernapasan lain)',
  'J11.1': 'Influenza with other respiratory manifestations, virus not identified (Influenza tanpa identifikasi virus)',
  'J12.9': 'Viral pneumonia, unspecified (Pneumonia virus, tidak spesifik)',
  'J13': 'Pneumonia due to Streptococcus pneumoniae (Pneumonia pneumokokus)',
  'J15.9': 'Bacterial pneumonia, unspecified (Pneumonia bakteri, tidak spesifik)',
  'J18.0': 'Bronchopneumonia, unspecified (Bronkopneumonia, tidak spesifik)',
  'J18.9': 'Pneumonia, unspecified (Pneumonia, tidak spesifik)',
  'J20.9': 'Acute bronchitis, unspecified (Bronkitis akut, tidak spesifik)',
  'J21.9': 'Acute bronchiolitis, unspecified (Bronkiolitis akut, tidak spesifik)',
  'J22': 'Unspecified acute lower respiratory infection (Infeksi saluran napas bawah akut, tidak spesifik)',
  'J30.4': 'Allergic rhinitis, unspecified (Rinitis alergi, tidak spesifik)',
  'J32.9': 'Chronic sinusitis, unspecified (Sinusitis kronis, tidak spesifik)',
  'J35.0': 'Chronic tonsillitis (Tonsilitis kronis)',
  'J38.0': 'Paralysis of vocal cords and larynx (Paralisis pita suara)',
  'J40': 'Bronchitis, not specified as acute or chronic (Bronkitis, tidak spesifik akut/kronis)',
  'J42': 'Unspecified chronic bronchitis (Bronkitis kronis, tidak spesifik)',
  'J44.1': 'Chronic obstructive pulmonary disease with acute exacerbation, unspecified (PPOK dengan eksaserbasi akut)',
  'J44.9': 'Chronic obstructive pulmonary disease, unspecified (PPOK, tidak spesifik)',
  'J45.0': 'Predominantly allergic asthma (Asma alergi)',
  'J45.1': 'Nonallergic asthma (Asma non-alergi)',
  'J45.9': 'Asthma, unspecified (Asma, tidak spesifik)',
  'J46': 'Status asthmaticus (Status asmatikus)',
  'J47': 'Bronchiectasis (Bronkiektasis)',
  'J69.0': 'Pneumonitis due to food and vomit (Pneumonitis aspirasi)',
  'J80': 'Adult respiratory distress syndrome (Sindrom gangguan pernapasan akut / ARDS)',
  'J81': 'Pulmonary oedema (Edema paru)',
  'J84.9': 'Interstitial pulmonary disease, unspecified (Penyakit paru interstisial, tidak spesifik)',
  'J90': 'Pleural effusion, not elsewhere classified (Efusi pleura)',
  'J93.9': 'Pneumothorax, unspecified (Pneumotoraks, tidak spesifik)',
  'J96.0': 'Acute respiratory failure (Gagal napas akut)',
  'J96.9': 'Respiratory failure, unspecified (Gagal napas, tidak spesifik)',
  'J98.4': 'Other disorders of lung (Gangguan paru lainnya)',

  // ─── K00–K93: Penyakit Sistem Pencernaan ────────────────────────────────
  'K02.9': 'Dental caries, unspecified (Karies gigi, tidak spesifik)',
  'K04.7': 'Periapical abscess without sinus (Abses periapikal gigi)',
  'K05.9': 'Gingivitis and periodontal disease, unspecified (Gingivitis dan penyakit periodontal)',
  'K12.0': 'Recurrent oral aphthae (Sariawan berulang)',
  'K20': 'Oesophagitis (Esofagitis / radang kerongkongan)',
  'K21.9': 'Gastro-oesophageal reflux disease without oesophagitis (GERD / asam lambung naik tanpa esofagitis)',
  'K25.9': 'Gastric ulcer, unspecified (Tukak lambung, tidak spesifik)',
  'K26.9': 'Duodenal ulcer, unspecified (Tukak duodenum, tidak spesifik)',
  'K27.9': 'Peptic ulcer, site unspecified (Tukak peptik, lokasi tidak spesifik)',
  'K29.0': 'Acute haemorrhagic gastritis (Gastritis hemoragik akut)',
  'K29.7': 'Gastritis, unspecified (Gastritis / maag, tidak spesifik)',
  'K30': 'Functional dyspepsia (Dispepsia fungsional)',
  'K31.9': 'Disease of stomach and duodenum, unspecified (Penyakit lambung dan duodenum, tidak spesifik)',
  'K35.3': 'Acute appendicitis with localized peritonitis (Apendisitis akut dengan peritonitis lokal)',
  'K35.80': 'Acute appendicitis, unspecified (Apendisitis akut, tidak spesifik)',
  'K36': 'Other appendicitis (chronic appendicitis) (Apendisitis kronis)',
  'K37': 'Unspecified appendicitis (Apendisitis, tidak spesifik)',
  'K40.9': 'Inguinal hernia, without obstruction or gangrene (Hernia inguinalis tanpa obstruksi)',
  'K42.9': 'Umbilical hernia, without obstruction or gangrene (Hernia umbilikalis / pusar)',
  'K43.9': 'Ventral hernia, without obstruction or gangrene (Hernia ventral / dinding perut)',
  'K44.9': 'Diaphragmatic hernia, without obstruction or gangrene (Hernia diafragma)',
  'K52.9': 'Noninfective gastroenteritis and colitis, unspecified (Gastroenteritis dan kolitis non-infeksi)',
  'K56.6': 'Other and unspecified intestinal obstruction (Obstruksi/sumbatan usus, tidak spesifik)',
  'K57.9': 'Diverticular disease of intestine, unspecified (Penyakit divertikular usus)',
  'K58.9': 'Irritable bowel syndrome without diarrhoea (Sindrom iritasi usus / IBS)',
  'K59.0': 'Constipation (Konstipasi / sembelit)',
  'K59.1': 'Functional diarrhoea (Diare fungsional)',
  'K60.2': 'Anal fissure, unspecified (Fisura ani, tidak spesifik)',
  'K61.0': 'Anal abscess (Abses anus)',
  'K62.5': 'Haemorrhage of anus and rectum (Perdarahan anus dan rektum)',
  'K63.9': 'Disease of intestine, unspecified (Penyakit usus, tidak spesifik)',
  'K65.9': 'Peritonitis, unspecified (Peritonitis, tidak spesifik)',
  'K70.3': 'Alcoholic cirrhosis of liver (Sirosis hati akibat alkohol)',
  'K70.9': 'Alcoholic liver disease, unspecified (Penyakit hati akibat alkohol, tidak spesifik)',
  'K71.9': 'Toxic liver disease, unspecified (Penyakit hati toksik, tidak spesifik)',
  'K72.9': 'Hepatic failure, unspecified (Gagal hati, tidak spesifik)',
  'K73.9': 'Chronic hepatitis, unspecified (Hepatitis kronis, tidak spesifik)',
  'K74.6': 'Other and unspecified cirrhosis of liver (Sirosis hati, tidak spesifik)',
  'K76.0': 'Fatty (change of) liver, not elsewhere classified (Perlemakan hati)',
  'K80.1': 'Calculus of gallbladder with other cholecystitis (Batu empedu dengan kolesistitis)',
  'K80.2': 'Calculus of gallbladder without cholecystitis (Batu kandung empedu tanpa kolesistitis)',
  'K81.9': 'Cholecystitis, unspecified (Kolesistitis / radang kandung empedu, tidak spesifik)',
  'K83.0': 'Cholangitis (Kolangitis)',
  'K85.9': 'Acute pancreatitis, unspecified (Pankreatitis akut, tidak spesifik)',
  'K86.1': 'Other chronic pancreatitis (Pankreatitis kronis)',
  'K92.0': 'Haematemesis (Muntah darah)',
  'K92.1': 'Melaena (BAB berdarah / hitam)',
  'K92.2': 'Gastrointestinal haemorrhage, unspecified (Perdarahan saluran cerna, tidak spesifik)',

  // ─── L00–L99: Penyakit Kulit dan Jaringan Subkutan ─────────────────────
  'L01.0': 'Impetigo (Impetigo)',
  'L02.9': 'Cutaneous abscess, furuncle and carbuncle, unspecified (Abses kulit / bisul, tidak spesifik)',
  'L03.9': 'Cellulitis, unspecified (Selulitis, tidak spesifik)',
  'L08.9': 'Local infection of skin and subcutaneous tissue, unspecified (Infeksi lokal kulit, tidak spesifik)',
  'L20.9': 'Atopic dermatitis, unspecified (Dermatitis atopik, tidak spesifik)',
  'L21.9': 'Seborrhoeic dermatitis, unspecified (Dermatitis seboroik, tidak spesifik)',
  'L23.9': 'Allergic contact dermatitis, unspecified cause (Dermatitis kontak alergi)',
  'L24.9': 'Irritant contact dermatitis, unspecified cause (Dermatitis kontak iritan)',
  'L25.9': 'Unspecified contact dermatitis, unspecified cause (Dermatitis kontak, tidak spesifik)',
  'L29.9': 'Pruritus, unspecified (Gatal, tidak spesifik)',
  'L30.9': 'Dermatitis, unspecified (Dermatitis, tidak spesifik)',
  'L40.9': 'Psoriasis, unspecified (Psoriasis, tidak spesifik)',
  'L50.9': 'Urticaria, unspecified (Urtikaria / biduran)',
  'L57.0': 'Actinic keratosis (Keratosis aktinik)',
  'L70.0': 'Acne vulgaris (Jerawat)',
  'L72.0': 'Epidermal cyst (Kista epidermis)',
  'L73.9': 'Follicular disorder, unspecified (Gangguan folikel rambut, tidak spesifik)',
  'L98.4': 'Chronic ulcer of skin, not elsewhere classified (Ulkus / luka kulit kronis)',

  // ─── M00–M99: Penyakit Sistem Muskuloskeletal dan Jaringan Ikat ────────
  'M00.9': 'Pyogenic arthritis, unspecified (Artritis piogenik / infeksi sendi)',
  'M05.9': 'Rheumatoid arthritis, unspecified (Artritis reumatoid, tidak spesifik)',
  'M06.9': 'Rheumatoid arthritis, unspecified (Artritis reumatoid, tidak spesifik)',
  'M10.9': 'Gout, unspecified (Asam urat / gout, tidak spesifik)',
  'M15.9': 'Polyosteoarthritis, unspecified (Osteoartritis banyak sendi)',
  'M17.9': 'Gonarthrosis, unspecified (Osteoartritis lutut)',
  'M19.9': 'Osteoarthritis, unspecified (Osteoartritis, tidak spesifik)',
  'M25.5': 'Pain in joint (Nyeri sendi)',
  'M32.9': 'Systemic lupus erythematosus, unspecified (Lupus eritematosus sistemik)',
  'M47.9': 'Spondylosis, unspecified (Spondilosis, tidak spesifik)',
  'M48.0': 'Spinal stenosis (Penyempitan kanal tulang belakang)',
  'M51.9': 'Intervertebral disc disorder, unspecified (Gangguan diskus/bantalan tulang belakang)',
  'M54.5': 'Low back pain (Nyeri punggung bawah)',
  'M54.9': 'Dorsalgia, unspecified (Nyeri punggung, tidak spesifik)',
  'M62.9': 'Disorder of muscle, unspecified (Gangguan otot, tidak spesifik)',
  'M79.1': 'Myalgia (Nyeri otot)',
  'M79.3': 'Panniculitis, unspecified (Radang jaringan lemak di bawah kulit)',
  'M79.6': 'Pain in limb (Nyeri tungkai/lengan)',
  'M81.9': 'Osteoporosis, unspecified (Osteoporosis, tidak spesifik)',

  // ─── N00–N99: Penyakit Sistem Genitourinari ────────────────────────────
  'N10': 'Acute tubulo-interstitial nephritis [acute pyelonephritis] (Pielonefritis akut)',
  'N11.9': 'Chronic tubulo-interstitial nephritis, unspecified (Pielonefritis kronis, tidak spesifik)',
  'N17.9': 'Acute kidney failure, unspecified (Gagal ginjal akut, tidak spesifik)',
  'N18.3': 'Chronic kidney disease, stage 3 (Penyakit ginjal kronis stadium 3)',
  'N18.5': 'Chronic kidney disease, stage 5 (Penyakit ginjal kronis stadium 5)',
  'N18.9': 'Chronic kidney disease, unspecified (Penyakit ginjal kronis, tidak spesifik)',
  'N19': 'Unspecified kidney failure (Gagal ginjal, tidak spesifik)',
  'N20.0': 'Calculus of kidney (Batu ginjal)',
  'N20.1': 'Calculus of ureter (Batu ureter)',
  'N21.0': 'Calculus in bladder (Batu kandung kemih)',
  'N30.0': 'Acute cystitis (Sistitis / radang kandung kemih akut)',
  'N30.9': 'Cystitis, unspecified (Sistitis, tidak spesifik)',
  'N39.0': 'Urinary tract infection, site not specified (ISK, lokasi tidak spesifik)',
  'N40': 'Hyperplasia of prostate (Pembesaran prostat jinak)',
  'N41.9': 'Inflammatory disease of prostate, unspecified (Prostatitis, tidak spesifik)',
  'N43.3': 'Hydrocele, unspecified (Hidrokel, tidak spesifik)',
  'N60.9': 'Benign mammary dysplasia, unspecified (Displasia payudara jinak, tidak spesifik)',
  'N64.9': 'Disorder of breast, unspecified (Gangguan payudara, tidak spesifik)',
  'N76.0': 'Acute vaginitis (Vaginitis akut)',
  'N80.9': 'Endometriosis, unspecified (Endometriosis, tidak spesifik)',
  'N83.2': 'Other and unspecified ovarian cysts (Kista ovarium, tidak spesifik)',
  'N92.0': 'Excessive and frequent menstruation with regular cycle (Menstruasi berlebihan dengan siklus teratur)',
  'N92.6': 'Irregular menstruation, unspecified (Menstruasi tidak teratur, tidak spesifik)',
  'N93.9': 'Abnormal uterine and vaginal bleeding, unspecified (Perdarahan uterus/vagina abnormal)',
  'N94.6': 'Dysmenorrhoea, unspecified (Nyeri haid, tidak spesifik)',

  // ─── O00–O99: Kehamilan, Persalinan, dan Nifas ─────────────────────────
  'O03.9': 'Spontaneous abortion, complete or unspecified, without complication (Keguguran spontan)',
  'O14.9': 'Pre-eclampsia, unspecified (Pre-eklampsia, tidak spesifik)',
  'O15.9': 'Eclampsia, unspecified as to time period (Eklampsia)',
  'O20.0': 'Threatened abortion (Ancaman keguguran)',
  'O21.0': 'Mild hyperemesis gravidarum (Hiperemesis gravidarum ringan / mual-muntah hebat pada kehamilan)',
  'O21.1': 'Hyperemesis gravidarum with metabolic disturbance (Hiperemesis gravidarum dengan gangguan metabolik)',
  'O23.9': 'Unspecified infection of urinary tract in pregnancy (ISK dalam kehamilan, tidak spesifik)',
  'O24.4': 'Diabetes mellitus arising in pregnancy (Diabetes gestasional)',
  'O26.9': 'Pregnancy-related condition, unspecified (Kondisi terkait kehamilan, tidak spesifik)',
  'O42.9': 'Premature rupture of membranes, unspecified (Ketuban pecah dini, tidak spesifik)',
  'O44.1': 'Placenta praevia with haemorrhage (Plasenta previa dengan perdarahan)',
  'O60.1': 'Preterm labour with preterm delivery (Persalinan prematur)',
  'O63.9': 'Long labour, unspecified (Persalinan lama, tidak spesifik)',
  'O68': "Labour and delivery complicated by fetal stress [distress] (Persalinan dengan gawat janin)",
  'O70.9': 'Obstetric perineal laceration, unspecified (Robekan perineum saat persalinan, tidak spesifik)',
  'O72.1': 'Other immediate postpartum haemorrhage (Perdarahan pascasalin lainnya)',
  'O80': 'Single spontaneous delivery (Persalinan spontan tunggal)',
  'O82.9': 'Delivery by caesarean section, unspecified (Persalinan sesar, tidak spesifik)',
  'O99.0': 'Anaemia complicating pregnancy, childbirth and the puerperium (Anemia dalam kehamilan)',

  // ─── P00–P96: Kondisi Perinatal ─────────────────────────────────────────
  'P07.1': 'Other low birth weight (Berat lahir rendah lainnya)',
  'P07.3': 'Other preterm infants (Bayi prematur lainnya)',
  'P22.0': 'Respiratory distress syndrome of newborn (Sindrom gawat napas pada bayi baru lahir)',
  'P22.9': 'Respiratory distress of newborn, unspecified (Gawat napas neonatus, tidak spesifik)',
  'P36.9': 'Bacterial sepsis of newborn, unspecified (Sepsis bakteri pada bayi baru lahir)',
  'P59.0': 'Neonatal jaundice associated with preterm delivery (Ikterus neonatorum terkait prematuritas)',
  'P59.9': 'Neonatal jaundice, unspecified (Ikterus / kuning pada bayi baru lahir, tidak spesifik)',

  // ─── Q00–Q99: Kelainan Bawaan (Kongenital) ─────────────────────────────
  'Q21.0': 'Ventricular septal defect (Defek septum ventrikel / kebocoran sekat bilik jantung)',
  'Q21.1': 'Atrial septal defect (Defek septum atrium / kebocoran sekat serambi jantung)',

  // ─── R00–R99: Gejala, Tanda, dan Temuan Klinis Abnormal ────────────────
  'R05': 'Cough (Batuk)',
  'R06.0': 'Dyspnoea (Sesak napas)',
  'R07.4': 'Chest pain, unspecified (Nyeri dada, tidak spesifik)',
  'R10.4': 'Other and unspecified abdominal pain (Nyeri perut, tidak spesifik)',
  'R11': 'Nausea and vomiting (Mual dan muntah)',
  'R50.9': 'Fever, unspecified (Demam, tidak spesifik)',
  'R51': 'Headache (Sakit kepala)',
  'R52.9': 'Pain, unspecified (Nyeri, tidak spesifik)',
  'R53': 'Malaise and fatigue (Lemas dan kelelahan)',
  'R55': 'Syncope and collapse (Pingsan dan kolaps)',
  'R56.8': 'Other and unspecified convulsions (Kejang, tidak spesifik)',
  'R57.9': 'Shock, unspecified (Syok, tidak spesifik)',
  'R73.9': 'Hyperglycaemia, unspecified (Kadar gula darah tinggi, tidak spesifik)',
  'R74.0': 'Elevation of levels of transaminase and lactic acid dehydrogenase [LDH] (Peningkatan enzim hati)',
  'R91': 'Abnormal findings on diagnostic imaging of lung (Temuan abnormal pencitraan paru)',

  // ─── S00–T98: Cedera, Keracunan, dan Akibat Sebab Luar ─────────────────
  'S00.9': 'Superficial injury of head, unspecified (Cedera superfisial kepala, tidak spesifik)',
  'S01.9': 'Open wound of head, unspecified (Luka terbuka kepala, tidak spesifik)',
  'S06.0': 'Concussion (Gegar otak)',
  'S06.9': 'Intracranial injury, unspecified (Cedera intrakranial, tidak spesifik)',
  'S09.9': 'Unspecified injury of head (Cedera kepala, tidak spesifik)',
  'S12.9': 'Fracture of neck, unspecified (Patah tulang leher, tidak spesifik)',
  'S22.9': 'Fracture of rib(s), sternum and thoracic spine, unspecified (Patah tulang rusuk/sternum, tidak spesifik)',
  'S32.0': 'Fracture of lumbar vertebra (Patah tulang belakang lumbal)',
  'S42.9': 'Fracture of shoulder girdle, part unspecified (Patah tulang bahu, tidak spesifik)',
  'S52.9': 'Fracture of forearm, unspecified (Patah tulang lengan bawah, tidak spesifik)',
  'S62.9': 'Fracture at wrist and hand level, unspecified (Patah tulang pergelangan tangan/tangan, tidak spesifik)',
  'S72.9': 'Fracture of femur, unspecified (Patah tulang paha, tidak spesifik)',
  'S82.9': 'Fracture of lower leg, unspecified (Patah tulang tungkai bawah, tidak spesifik)',
  'S92.9': 'Fracture of foot, unspecified (Patah tulang kaki, tidak spesifik)',
  'S93.4': 'Sprain and strain of ankle (Keseleo pergelangan kaki)',
  'T14.9': 'Injury, unspecified (Cedera, tidak spesifik)',
  'T78.4': 'Allergy, unspecified (Alergi, tidak spesifik)',
  'T81.4': 'Infection following a procedure, not elsewhere classified (Infeksi pasca prosedur/operasi)',

  // ─── Z00–Z99: Faktor yang Memengaruhi Status Kesehatan ─────────────────
  'Z00.0': 'General medical examination (Pemeriksaan medis umum)',
  'Z34.9': 'Supervision of normal pregnancy, unspecified (Pengawasan/kontrol kehamilan normal)',
  'Z51.1': 'Chemotherapy session for neoplasm (Sesi kemoterapi)',
  'Z96.1': 'Presence of intraocular lens (Adanya lensa intraokular / pasca operasi katarak)'
};

/**
 * Ambil deskripsi ICD-10 untuk satu kode. Case-insensitive dan toleran
 * terhadap spasi ekstra atau format "KODE/ALT" (mengambil segmen pertama).
 * Mengembalikan "—" bila kode tidak ditemukan di kamus.
 */
export function getICD10Description(code: string | null | undefined): string {
  const normalized = normalizeICD10Code(code);
  if (!normalized) return '—';
  return ICD10_DESCRIPTIONS[normalized] || '—';
}

function normalizeICD10Code(code: string | null | undefined): string | null {
  if (!code) return null;
  let normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  // Beberapa sumber data menuliskan kode alternatif dengan "/" (mis. "A15.0/A16.2")
  // — ambil segmen pertama sebagai kode utama.
  if (normalized.includes('/')) {
    normalized = normalized.split('/')[0].trim();
  }
  return normalized || null;
}

/**
 * Parse string berisi banyak kode (dipisah ";" atau ",") lalu ambil
 * deskripsi masing-masing kode. Berguna untuk field seperti DIAGLIST
 * yang bisa berisi "A09.9;J45.9".
 */
export function getICD10DescriptionsForCodes(
  codesString: string | null | undefined
): Array<{ code: string; description: string }> {
  if (!codesString) return [];
  return codesString
    .split(/[;,]/)
    .map(c => c.trim())
    .filter(Boolean)
    .map(code => ({ code, description: getICD10Description(code) }));
}
