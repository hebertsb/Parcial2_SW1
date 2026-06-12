from pymongo import MongoClient
from datetime import datetime

client = MongoClient('mongodb+srv://hebertsb08_db_user:g8SspkYSGab87Ecz@cluster0.lbxfuez.mongodb.net/nexusflow_oficial?retryWrites=true&w=majority')
db = client['nexusflow_oficial']

antes = db.Bitacora.count_documents({})
corte = datetime(2026, 1, 1)
result = db.Bitacora.delete_many({'fecha_hora': {'$lt': corte}})
despues = db.Bitacora.count_documents({})

print('Antes: %d | Eliminados: %d | Ahora: %d' % (antes, result.deleted_count, despues))
client.close()
