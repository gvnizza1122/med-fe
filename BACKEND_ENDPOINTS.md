# Backend Endpoints: Saran Koding

Spesifikasi lengkap backend endpoints yang diperlukan untuk fitur saran koding. Implementasi menggunakan Express.js atau framework lain sesuai existing codebase.

## Endpoint 1: Extract Clinical Facts

**Path**: `POST /api/v1/coding/extract-facts`

**Purpose**: Ekstraksi fakta klinis dari Resume Medis dengan halaman + quotation

### Request

```json
{
  "record_id": "firdan-001",
  "diagnosis_sentence": "Bronchial asthma with status asthmaticus, SpO2 78% on admission",
  "procedure_sentence": "Oxygen therapy via nebulizer with bronchodilators, inhalation therapy",
  "jenis_klaim": "RAWAT_INAP"
}
```

### Response (200 OK)

```json
{
  "record_id": "firdan-001",
  "patient_name": "Firdan Muhammad",
  "admission_date": "2026-09-15",
  "discharge_date": "2026-09-18",
  "jenis_klaim": "RAWAT_INAP",
  "facts": [
    {
      "type": "diagnosis",
      "text": "Bronchial asthma with status asthmaticus",
      "page_number": 1,
      "quotation": "Bronchial asthma, status asthmaticus",
      "context": "Chief complaint & diagnosis section"
    },
    {
      "type": "vital_sign",
      "text": "SpO2 78% on admission",
      "page_number": 1,
      "quotation": "SpO2 78% saat masuk",
      "context": "Vital signs monitoring"
    },
    {
      "type": "procedure",
      "text": "Oxygen therapy via nebulizer with bronchodilators",
      "page_number": 1,
      "quotation": "Oxygen therapy, inhalation therapy with bronchodilators",
      "context": "Treatment section"
    }
  ],
  "summary": "Pasien Firdan, 3 hari rawat inap dengan asma akut + status asthmaticus, SpO2 rendah yang membaik dengan nebulisasi dan O2."
}
```

### Response (400 Bad Request)

```json
{
  "error": "Diagnosis sentence dan procedure sentence tidak boleh kosong"
}
```

### Response (500 Server Error)

```json
{
  "error": "Gagal mengekstrak fakta klinis. Periksa format input dan coba lagi."
}
```

### Implementation Notes

- Use LLM (Claude/GPT) to extract clinical facts from sentences
- Untuk setiap fact, harus identify halaman di dokumen + quotation langsung dari dokumen
- Jika quotation tidak ditemukan, skip fact itu (jangan guess)
- Summary harus 1-2 kalimat ringkasan kasus
- Timeout: 10 detik

---

## Endpoint 2: Suggest Codes with Citations

**Path**: `POST /api/v1/coding/suggest-codes`

**Purpose**: LLM suggest ICD-10/ICD-9 codes, SETIAP kode HARUS punya quotation + page_number

### Request

```json
{
  "clinical_extract": {
    "record_id": "firdan-001",
    "patient_name": "Firdan Muhammad",
    "admission_date": "2026-09-15",
    "discharge_date": "2026-09-18",
    "jenis_klaim": "RAWAT_INAP",
    "facts": [
      {
        "type": "diagnosis",
        "text": "Bronchial asthma with status asthmaticus",
        "page_number": 1,
        "quotation": "Bronchial asthma, status asthmaticus",
        "context": "Chief complaint"
      }
    ],
    "summary": "..."
  }
}
```

### Response (200 OK)

```json
{
  "diagnosis_codes": [
    {
      "code": "J45.9",
      "system": "ICD-10-WHO",
      "description": "Asthma, unspecified",
      "quotation": "Bronchial asthma, status asthmaticus",
      "page_number": 1,
      "confidence": "high",
      "reasoning": "Status asthmaticus dengan desaturasi O2 berat (78%)"
    }
  ],
  "procedure_codes": [
    {
      "code": "93.94",
      "system": "ICD-9-CM",
      "description": "Nebulizer therapy",
      "quotation": "Oxygen therapy, inhalation therapy with bronchodilators",
      "page_number": 1,
      "confidence": "high",
      "reasoning": "Nebulisasi dengan bronchodilators, terapi utama untuk status asthmaticus"
    }
  ],
  "rejected_codes": []
}
```

### Response (400 Bad Request)

```json
{
  "error": "Clinical extract tidak valid. Pastikan facts memiliki quotation."
}
```

### Response (500 Server Error)

```json
{
  "error": "LLM API error. Coba lagi dalam beberapa saat."
}
```

### Implementation Notes

- **CRITICAL**: Setiap kode MUST have quotation + page_number
- Jika LLM suggest kode tanpa quotation, endpoint harus reject itu
- Confidence: HIGH (90-100%), MEDIUM (70-89%), LOW (50-69%)
- Jika confidence < 50%, reject code (ke rejected_codes)
- Support ICD-10-WHO (diagnosis) + ICD-9-CM (procedure)
- Timeout: 15 detik
- Use multi-shot prompting with examples dari Firdan case

---

## Endpoint 3: Group Codes to INA-CBG

**Path**: `POST /api/v1/coding/group-codes`

**Purpose**: Grouping codes to INA-CBG. **BLIND TO TARIFF** — tidak terima tarif sebagai input.

### Request

```json
{
  "diagnosis_codes": ["J45.9"],
  "procedure_codes": ["93.94"],
  "jenis_klaim": "RAWAT_INAP"
}
```

**PENTING**: Request TIDAK include `tariff` atau `tariff_input`. Grouping murni klinis.

### Response (200 OK)

```json
{
  "inacbg_suggestion": "A82XXX",
  "reasoning": "Diagnosis J45.9 (asthma unspecified) + procedure 93.94 (nebulizer) + RAWAT_INAP = INA-CBG A82XXX per PMK 3/2023 grouping logic.",
  "alternatives": [
    {
      "rank": 2,
      "inacbg_code": "A81XXX",
      "diagnosis_codes": ["J45.1"],
      "procedure_codes": ["93.90"],
      "reason_not_selected": "J45.1 (Nonallergic asthma) tanpa bukti alergi di dokumen. 93.90 (Respiratory therapy) terlalu umum dibanding 93.94 yang lebih spesifik.",
      "evidence": "nebulisasi terdokumentasi di 2 bagian dokumen"
    },
    {
      "rank": 3,
      "inacbg_code": "A83XXX",
      "diagnosis_codes": ["J45.0"],
      "procedure_codes": ["93.95"],
      "reason_not_selected": "J45.0 bukan status asthmaticus. 93.95 adalah chest physiotherapy, bukan nebulisasi.",
      "evidence": "tidak ada bukti physiotherapy di dokumen"
    }
  ]
}
```

### Response (400 Bad Request)

```json
{
  "error": "Diagnosis codes dan procedure codes tidak boleh kosong"
}
```

### Implementation Notes

- **CRITICAL**: Function HARUS NOT menerima tariff parameter
- Grouping logic harus pure clinical: diagnosis + procedure + jenis_klaim
- Generate 2-3 alternatives untuk perbandingan
- Setiap alternatif harus punya reasoning & evidence
- Support existing INA-CBG grouper logic (e.g., dari backend claimFiles.js)
- Timeout: 5 detik

---

## Endpoint 4: Lookup Tariff

**Path**: `POST /api/v1/coding/tariff-lookup`

**Purpose**: Lookup tarif dari PMK 3/2023 Regional 1 Kelas D. **RESULT-ONLY** — tariff bukan input grouping.

### Request

```json
{
  "inacbg_code": "A82XXX",
  "region": "Regional 1",
  "kelas_rs": "D"
}
```

### Response (200 OK) - Jika Data Tersedia

```json
{
  "inacbg_code": "A82XXX",
  "tariff": 2500000,
  "source": "PMK 3/2023 Regional 1 Kelas D",
  "region": "Regional 1",
  "class": "D"
}
```

### Response (200 OK) - Jika Data Belum Tersedia (Temporary)

```json
{
  "inacbg_code": "A82XXX",
  "tariff": null,
  "source": "PMK 3/2023 Regional 1 Kelas D (data sedang dimuat)",
  "region": "Regional 1",
  "class": "D"
}
```

### Response (404 Not Found) - Jika Kode INA-CBG Tidak Valid

```json
{
  "error": "Kode INA-CBG A82XXX tidak ditemukan di tabel PMK 3/2023"
}
```

### Implementation Notes

- Tariff data saat ini belum tersedia (Phase 1)
- Endpoint boleh return null tariff tanpa error
- Frontend akan handle null tariff gracefully
- Siapkan table structure untuk PMK 3/2023:
  ```sql
  CREATE TABLE pmk_3_2023_tariffs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    inacbg_code VARCHAR(10),
    region VARCHAR(20),
    kelas_rs VARCHAR(5),
    tariff BIGINT,
    effective_date DATE,
    source VARCHAR(100)
  );
  ```
- Timeout: 2 detik

---

## Endpoint 5: Generate Alternatives

**Path**: `POST /api/v1/coding/alternatives`

**Purpose**: Generate alternative codes + reasoning untuk codes yang tidak dipilih

### Request

```json
{
  "diagnosis_codes": [
    {
      "code": "J45.9",
      "system": "ICD-10-WHO",
      "description": "Asthma, unspecified",
      "quotation": "Bronchial asthma, status asthmaticus",
      "page_number": 1,
      "confidence": "high",
      "reasoning": "..."
    }
  ],
  "procedure_codes": [
    {
      "code": "93.94",
      "system": "ICD-9-CM",
      "description": "Nebulizer therapy",
      "quotation": "Oxygen therapy, inhalation therapy with bronchodilators",
      "page_number": 1,
      "confidence": "high",
      "reasoning": "..."
    }
  ],
  "selected_inacbg": "A82XXX",
  "clinical_extract": {
    "facts": [...],
    "summary": "..."
  }
}
```

### Response (200 OK)

```json
[
  {
    "rank": 2,
    "inacbg_code": "A81XXX",
    "diagnosis_codes": ["J45.1"],
    "procedure_codes": ["93.90"],
    "reason_not_selected": "J45.1 (Nonallergic asthma) tidak ada bukti alergi di dokumen. 93.90 (Respiratory therapy) terlalu umum dibanding 93.94.",
    "evidence": "nebulisasi terdokumentasi di 2 bagian dokumen (Halaman 1 & Treatment notes)"
  },
  {
    "rank": 3,
    "inacbg_code": "A83XXX",
    "diagnosis_codes": ["J45.0"],
    "procedure_codes": ["93.95"],
    "reason_not_selected": "J45.0 bukan status asthmaticus. 93.95 adalah chest physiotherapy, tidak sesuai prosedur di dokumen.",
    "evidence": "tidak ada bukti physiotherapy; prosedur nyata adalah nebulisasi & O2 therapy"
  }
]
```

### Response (200 OK) - Jika Tidak Ada Alternatif

```json
[]
```

### Implementation Notes

- Generate 2-3 alternatives based on similar grouper outputs
- Reasoning harus jelas & referensikan bukti dari dokumen
- Evidence harus cite specific page numbers atau sections
- Timeout: 5 detik
- Call generate_alternatives AFTER grouping finalized

---

## Error Handling Standards

### Common Error Responses

**400 Bad Request** — Input validation error
```json
{
  "error": "Field 'record_id' is required"
}
```

**401 Unauthorized** — Missing/invalid token
```json
{
  "error": "Sesi Anda telah berakhir. Silakan masuk kembali."
}
```

**403 Forbidden** — User tidak punya permission
```json
{
  "error": "Anda tidak memiliki akses untuk tindakan ini."
}
```

**500 Server Error** — Backend error
```json
{
  "error": "Terjadi gangguan pada sistem. Silakan coba lagi."
}
```

**504 Gateway Timeout** — LLM timeout
```json
{
  "error": "Permintaan memakan waktu terlalu lama. Silakan coba lagi."
}
```

### Message Localization

- Semua error message dalam Bahasa Indonesia (user-friendly)
- Jangan expose technical details (e.g., "LLM API returned 500")
- Verifikator hanya perlu tahu: APA error + BAGAIMANA fix

---

## Rate Limiting & Quotas

```
POST /api/v1/coding/* :
  - 10 requests per user per hour
  - 100 requests per IP per hour
  - Return 429 Too Many Requests jika limit exceeded
  - Header: Retry-After: 300 (5 menit)
```

---

## Monitoring & Logging

Log setiap request ke table `coding_suggestions_log`:

```sql
CREATE TABLE coding_suggestions_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id VARCHAR(50),
  record_id VARCHAR(50),
  step VARCHAR(50),  -- 'extract' | 'suggest' | 'group' | 'tariff' | 'alternatives'
  status VARCHAR(20),  -- 'success' | 'failure'
  error_message TEXT,
  processing_time_ms INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Gunakan untuk:
- Monitor feature adoption
- Identify common error patterns
- Optimize LLM prompts
- SLA tracking

---

## Testing

### Unit Tests

```bash
npm test -- tests/coding-service.test.js
```

Harus cover:
- Extract clinical facts dengan berbagai input
- Suggest codes dengan Firdan case → expect J45.9 + 93.94
- All codes have quotation validation
- Group codes blind to tariff
- Tariff lookup null handling
- Alternative generation

### Integration Tests

```bash
npm test -- tests/coding-service-integration.test.js
```

Test full pipeline:
- Record → Suggest → Group → Tariff → Alternatives
- Verify total processing time < 20 detik
- Verify audit logs created

---

## Deployment Checklist

- [ ] Semua 5 endpoints implemented
- [ ] Unit + integration tests passed
- [ ] Firdan case verified output
- [ ] Error messages user-friendly
- [ ] Rate limiting enabled
- [ ] Audit logging enabled
- [ ] Timeout set appropriately
- [ ] LLM prompt tested extensively
- [ ] Documentation updated
- [ ] Security review passed
