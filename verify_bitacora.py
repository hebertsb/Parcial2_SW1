from pymongo import MongoClient

# 1. Cuantos Bitacora conectan con Tramite real
print("=== JOIN Bitacora -> Tramite ===")
resultado = list(db.Bitacora.aggregate([
    {
        "$lookup": {
            "from": "Tramite",
            "localField": "tramite_id",
            "foreignField": "_id",
            "as": "tramite"
        }
    },
    {
        "$group": {
            "_id": {"encontrado": {"$gt": [{"$size": "$tramite"}, 0]}},
            "count": {"$sum": 1}
        }
    }
]))
for r in resultado:
    label = "CON tramite real" if r['_id']['encontrado'] else "HUERFANOS (sin tramite)"
    print("  %s: %d" % (label, r['count']))

# 2. Cuantos Bitacora ya tienen politica_id propio
print("\n=== Campo politica_id en Bitacora ===")
con_pol = db.Bitacora.count_documents({"politica_id": {"$exists": True, "$ne": None}})
sin_pol = db.Bitacora.count_documents({"politica_id": {"$exists": False}})
print("  Con politica_id: %d" % con_pol)
print("  Sin politica_id: %d" % sin_pol)

# 3. Tramite tiene empresa_id?
print("\n=== Campo empresa_id en Tramite ===")
con_emp = db.Tramite.count_documents({"empresa_id": {"$exists": True, "$ne": None}})
sin_emp = db.Tramite.count_documents({"empresa_id": {"$exists": False}})
total_tramites = db.Tramite.count_documents({})
print("  Total tramites: %d" % total_tramites)
print("  Con empresa_id: %d" % con_emp)
print("  Sin empresa_id: %d" % sin_emp)

# 4. Distribucion por politica en Bitacora (los que ya tienen politica_id)
print("\n=== Distribucion por politica_id en Bitacora ===")
dist = list(db.Bitacora.aggregate([
    {"$group": {"_id": "$politica_id", "count": {"$sum": 1}}},
    {"$sort": {"count": -1}}
]))
for r in dist[:10]:
    print("  %s: %d" % (r['_id'], r['count']))

client.close()
