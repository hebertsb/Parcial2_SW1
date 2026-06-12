from pymongo import MongoClient
from datetime import datetime

client = MongoClient('mongodb+srv://hebertsb08_db_user:g8SspkYSGab87Ecz@cluster0.lbxfuez.mongodb.net/nexusflow_oficial?retryWrites=true&w=majority')
db = client['nexusflow_oficial']

antes = db.Bitacora.count_documents({})

# Eliminar solo los registros sinteticos ruidosos (enero-marzo 2026)
# Los limpios por politica son de abril 2026+
# Los reales del sistema son de mayo-junio 2026
desde = datetime(2026, 1, 1)
hasta = datetime(2026, 4, 1)
result = db.Bitacora.delete_many({'fecha_hora': {'$gte': desde, '$lt': hasta}})

despues = db.Bitacora.count_documents({})
print('Antes: %d | Eliminados: %d | Ahora: %d' % (antes, result.deleted_count, despues))

from collections import Counter
todos = list(db.Bitacora.find({}, {'accion': 1, 'politica_id': 1, '_id': 0}))
print('\nPor politica:')
por_pol = {}
for r in todos:
    pol = r.get('politica_id', 'REAL')
    por_pol[pol] = por_pol.get(pol, 0) + 1
for k, v in sorted(por_pol.items(), key=lambda x: -x[1]):
    print('  %s: %d' % (k, v))

print('\nTotal por accion:')
dist = Counter(r['accion'] for r in todos)
for k, v in sorted(dist.items(), key=lambda x: -x[1]):
    print('  %-25s %d' % (k, v))

client.close()
