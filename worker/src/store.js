/** D1 records keep the ORIGINAL spreadsheet column order to preserve exact UI DTOs. */
export const json = (value, fallback = []) => { try { return JSON.parse(String(value || '')); } catch { return fallback; } };
export const bool = value => value === true || String(value).toLowerCase() === 'true';
export const str = value => value === undefined || value === null ? '' : String(value);
export const now = () => new Date().toISOString();
export const uuid = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
export const required = (value, label, max = 200) => { const s = str(value).trim(); if (!s) throw Error(label + ' is required.'); if (s.length > max) throw Error(label + ' exceeds ' + max + ' characters.'); return s; };
export const text = (value, max = 1000) => { const s = str(value).trim(); if (s.length > max) throw Error('Text exceeds ' + max + ' characters.'); return s; };
export const isDiscordId = id => /^\d{17,22}$/.test(str(id));
export const isoDate = s => /^\d{4}-\d{2}-\d{2}$/.test(str(s)) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const knownBuckets = new Set(['members','appointments','accessRoles','accessUsers','proposals','actDrafts','meetings','meetingAttendees','decisions','actions','press','letters','signatures','documentSignoffs','citizenshipQuestions','citizenshipAttempts','careerPositions','jobApplications','audit']);
function bucketOk(bucket) { if (!knownBuckets.has(bucket)) throw Error('Unknown database bucket'); return bucket; }
export class Store {
  constructor(db) { if (!db) throw Error('D1 binding DB is missing'); this.db = db; }
  async all(bucket) {
    bucketOk(bucket);
    const { results = [] } = await this.db.prepare('SELECT payload FROM records WHERE bucket=? ORDER BY seq ASC, record_id ASC').bind(bucket).all();
    return results.map(x => json(x.payload));
  }
  async get(bucket, id) {
    bucketOk(bucket);
    const r = await this.db.prepare('SELECT payload FROM records WHERE bucket=? AND record_id=?').bind(bucket, str(id)).first();
    return r ? json(r.payload) : null;
  }
  async save(bucket, id, row) {
    bucketOk(bucket);
    const seq = Number(Date.now());
    await this.db.prepare(`INSERT INTO records (bucket,record_id,payload,seq) VALUES (?,?,?,?)
      ON CONFLICT(bucket,record_id) DO UPDATE SET payload=excluded.payload,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now')`).bind(bucket,str(id),JSON.stringify(row),seq).run();
  }
  async create(bucket, id, row) {
    bucketOk(bucket);
    return this.db.prepare('INSERT INTO records (bucket,record_id,payload,seq) VALUES (?,?,?,?)')
      .bind(bucket,str(id),JSON.stringify(row),Date.now()).run();
  }
  async audit(identity, event, type, id, detail = '') {
    // Never log secrets or request bodies; history is visible only to viewAudit users.
    const at=now(), auditId = at+'_'+uuid();
    return this.create('audit',auditId,[at, identity.id, identity.username, event, type, str(id),str(detail).slice(0,500)]);
  }
}
