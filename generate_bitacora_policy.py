from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime, timedelta
import random

client = MongoClient('mongodb+srv://hebertsb08_db_user:g8SspkYSGab87Ecz@cluster0.lbxfuez.mongodb.net/nexusflow_oficial?retryWrites=true&w=majority')
db = client['nexusflow_oficial']

CLIENTES     = ['69dfccb5f663e82412cdba83', '69e1b5b9aa4c12289eae5f4e', '69ec461d122680675cb50c15']
FUNCIONARIOS = ['69dfcc34f663e82412cdba82', '69f02d8aa6889617eac52d84', '69f432e00d822854e1a9317d']

BASE_DATE = datetime(2026, 4, 1)

def rand_date(offset_days=0):
    return BASE_DATE + timedelta(days=offset_days) + timedelta(hours=random.randint(0, 8))

def make_id():
    return str(ObjectId())

def bita(tid, pol, accion, estado, uid, fecha, detalle=None):
    return {
        'tramite_id': tid, 'politica_id': pol,
        'accion': accion, 'estado': estado, 'estado_resultante': estado,
        'usuario_id': uid, 'fecha_hora': fecha,
        'detalle_ia': detalle or {},
        '_class': 'com.nexusflow.nexusflowbackend.model.Bitacora'
    }

registros = []
d = 0

# ============================================================
# POL-CREDITO: Flujo crédito estándar
# Dominante: INICIO→LLENADO→SUBIDA→APROBAR→FINALIZAR
# SIEMPRE requiere evidencia antes de aprobar
# ============================================================
POL = 'POL-CREDITO'
for i in range(70):
    tid = make_id()
    cli, fun = random.choice(CLIENTES), random.choice(FUNCIONARIOS)
    t = rand_date(d); d += 1
    if i < 55:  # 78% flujo limpio
        registros += [
            bita(tid, POL, 'INICIO_PROCESO',    'pendiente',  cli, t),
            bita(tid, POL, 'LLENADO_FORMULARIO','en_proceso', cli, t+timedelta(hours=1)),
            bita(tid, POL, 'SUBIDA_EVIDENCIA',  'en_proceso', cli, t+timedelta(hours=3),
                 {'archivo': 'credito_%s.pdf' % tid[:6]}),
            bita(tid, POL, 'APROBAR',           'en_revision',fun, t+timedelta(hours=8),
                 {'accion':'APROBAR','tiempo_en_nodo': random.randint(2,8)}),
            bita(tid, POL, 'FINALIZAR',         'finalizado', fun, t+timedelta(hours=random.randint(10,20))),
        ]
    elif i < 63:  # 11% con rechazo
        registros += [
            bita(tid, POL, 'INICIO_PROCESO',    'pendiente',  cli, t),
            bita(tid, POL, 'LLENADO_FORMULARIO','en_proceso', cli, t+timedelta(hours=1)),
            bita(tid, POL, 'SUBIDA_EVIDENCIA',  'en_proceso', cli, t+timedelta(hours=2),
                 {'archivo': 'credito_%s.pdf' % tid[:6]}),
            bita(tid, POL, 'RECHAZAR',          'rechazado',  fun, t+timedelta(hours=7),
                 {'motivo': 'No cumple requisitos crediticios'}),
        ]
    else:  # 10% con escalamiento
        registros += [
            bita(tid, POL, 'INICIO_PROCESO',    'pendiente',  cli, t),
            bita(tid, POL, 'LLENADO_FORMULARIO','en_proceso', cli, t+timedelta(hours=1)),
            bita(tid, POL, 'SUBIDA_EVIDENCIA',  'en_proceso', cli, t+timedelta(hours=3),
                 {'archivo': 'credito_%s.pdf' % tid[:6]}),
            bita(tid, POL, 'ESCALAR',           'escalado',   fun, t+timedelta(hours=80),
                 {'motivo': 'Excedio SLA', 'prioridad_nueva': 'Alta'}),
            bita(tid, POL, 'APROBAR',           'en_revision',fun, t+timedelta(hours=88),
                 {'accion':'APROBAR','post_escalamiento': True}),
            bita(tid, POL, 'FINALIZAR',         'finalizado', fun, t+timedelta(hours=96)),
        ]

# ============================================================
# 69e5761c: Doble aprobacion gerencial
# Dominante: INICIO→LLENADO→APROBAR→APROBAR→FINALIZAR
# Dos funcionarios distintos deben aprobar en cadena
# ============================================================
POL = '69e5761c86717357fbe4a96e'
for i in range(70):
    tid = make_id()
    cli = random.choice(CLIENTES)
    fun1, fun2 = FUNCIONARIOS[0], FUNCIONARIOS[1]
    t = rand_date(d); d += 1
    if i < 55:
        registros += [
            bita(tid, POL, 'INICIO_PROCESO',    'pendiente',  cli,  t),
            bita(tid, POL, 'LLENADO_FORMULARIO','en_proceso', cli,  t+timedelta(hours=2)),
            bita(tid, POL, 'APROBAR',           'en_revision',fun1, t+timedelta(hours=8),
                 {'accion':'APROBAR','nivel': 1}),
            bita(tid, POL, 'APROBAR',           'en_revision',fun2, t+timedelta(hours=16),
                 {'accion':'APROBAR','nivel': 2}),
            bita(tid, POL, 'FINALIZAR',         'finalizado', fun2, t+timedelta(hours=random.randint(18,30))),
        ]
    elif i < 63:
        registros += [
            bita(tid, POL, 'INICIO_PROCESO',    'pendiente',  cli,  t),
            bita(tid, POL, 'LLENADO_FORMULARIO','en_proceso', cli,  t+timedelta(hours=2)),
            bita(tid, POL, 'OBSERVAR',          'observado',  fun1, t+timedelta(hours=6),
                 {'motivo': 'Informacion insuficiente'}),
            bita(tid, POL, 'LLENADO_FORMULARIO','en_proceso', cli,  t+timedelta(hours=28)),
            bita(tid, POL, 'APROBAR',           'en_revision',fun1, t+timedelta(hours=34),
                 {'accion':'APROBAR','nivel': 1}),
            bita(tid, POL, 'APROBAR',           'en_revision',fun2, t+timedelta(hours=42),
                 {'accion':'APROBAR','nivel': 2}),
            bita(tid, POL, 'FINALIZAR',         'finalizado', fun2, t+timedelta(hours=50)),
        ]
    else:
        registros += [
            bita(tid, POL, 'INICIO_PROCESO',    'pendiente',  cli,  t),
            bita(tid, POL, 'LLENADO_FORMULARIO','en_proceso', cli,  t+timedelta(hours=1)),
            bita(tid, POL, 'RECHAZAR',          'rechazado',  fun1, t+timedelta(hours=5),
                 {'motivo': 'Requisitos no cumplidos en primer nivel'}),
        ]

# ============================================================
# 69f0f96a: Flujo con observacion obligatoria
# Dominante: INICIO→LLENADO→OBSERVAR→LLENADO→SUBIDA→APROBAR→FINALIZAR
# SIEMPRE pasa por observacion antes de aprobar
# ============================================================
POL = '69f0f96a1b4f1009733012c7'
for i in range(70):
    tid = make_id()
    cli, fun = random.choice(CLIENTES), random.choice(FUNCIONARIOS)
    t = rand_date(d); d += 1
    if i < 55:
        registros += [
            bita(tid, POL, 'INICIO_PROCESO',    'pendiente',  cli, t),
            bita(tid, POL, 'LLENADO_FORMULARIO','en_proceso', cli, t+timedelta(hours=1)),
            bita(tid, POL, 'OBSERVAR',          'observado',  fun, t+timedelta(hours=5),
                 {'motivo': 'Revision inicial requerida por politica'}),
            bita(tid, POL, 'LLENADO_FORMULARIO','en_proceso', cli, t+timedelta(hours=24)),
            bita(tid, POL, 'SUBIDA_EVIDENCIA',  'en_proceso', cli, t+timedelta(hours=26),
                 {'archivo': 'doc_%s.pdf' % tid[:6]}),
            bita(tid, POL, 'APROBAR',           'en_revision',fun, t+timedelta(hours=32),
                 {'accion':'APROBAR','tiempo_en_nodo': random.randint(2,8)}),
            bita(tid, POL, 'FINALIZAR',         'finalizado', fun, t+timedelta(hours=random.randint(34,48))),
        ]
    elif i < 63:
        registros += [
            bita(tid, POL, 'INICIO_PROCESO',    'pendiente',  cli, t),
            bita(tid, POL, 'LLENADO_FORMULARIO','en_proceso', cli, t+timedelta(hours=1)),
            bita(tid, POL, 'OBSERVAR',          'observado',  fun, t+timedelta(hours=5),
                 {'motivo': 'Primera revision'}),
            bita(tid, POL, 'LLENADO_FORMULARIO','en_proceso', cli, t+timedelta(hours=28)),
            bita(tid, POL, 'OBSERVAR',          'observado',  fun, t+timedelta(hours=34),
                 {'motivo': 'Segunda revision requerida'}),
            bita(tid, POL, 'SUBIDA_EVIDENCIA',  'en_proceso', cli, t+timedelta(hours=56)),
            bita(tid, POL, 'APROBAR',           'en_revision',fun, t+timedelta(hours=62)),
            bita(tid, POL, 'FINALIZAR',         'finalizado', fun, t+timedelta(hours=70)),
        ]
    else:
        registros += [
            bita(tid, POL, 'INICIO_PROCESO',    'pendiente',  cli, t),
            bita(tid, POL, 'LLENADO_FORMULARIO','en_proceso', cli, t+timedelta(hours=1)),
            bita(tid, POL, 'OBSERVAR',          'observado',  fun, t+timedelta(hours=4)),
            bita(tid, POL, 'RECHAZAR',          'rechazado',  fun, t+timedelta(hours=72),
                 {'motivo': 'No subsano observaciones en tiempo'}),
        ]

# ============================================================
# 69f3c15e...a6: Flujo con escalamiento obligatorio para montos altos
# Dominante: INICIO→LLENADO→SUBIDA→ESCALAR→APROBAR→LLENADO→APROBAR→FINALIZAR
# ============================================================
POL = '69f3c15e806aa96df48515a6'
for i in range(70):
    tid = make_id()
    cli, fun = random.choice(CLIENTES), random.choice(FUNCIONARIOS)
    fun2 = random.choice([f for f in FUNCIONARIOS if f != fun] or FUNCIONARIOS)
    t = rand_date(d); d += 1
    if i < 55:
        registros += [
            bita(tid, POL, 'INICIO_PROCESO',    'pendiente',  cli,  t),
            bita(tid, POL, 'LLENADO_FORMULARIO','en_proceso', cli,  t+timedelta(hours=2)),
            bita(tid, POL, 'SUBIDA_EVIDENCIA',  'en_proceso', cli,  t+timedelta(hours=4),
                 {'archivo': 'garantia_%s.pdf' % tid[:6]}),
            bita(tid, POL, 'ESCALAR',           'escalado',   fun,  t+timedelta(hours=48),
                 {'motivo': 'Monto alto requiere aprobacion gerencial', 'prioridad_nueva': 'Alta'}),
            bita(tid, POL, 'APROBAR',           'en_revision',fun2, t+timedelta(hours=56),
                 {'accion':'APROBAR','nivel': 'gerencial'}),
            bita(tid, POL, 'LLENADO_FORMULARIO','en_proceso', cli,  t+timedelta(hours=70)),
            bita(tid, POL, 'APROBAR',           'en_revision',fun,  t+timedelta(hours=76),
                 {'accion':'APROBAR','nivel': 'final'}),
            bita(tid, POL, 'FINALIZAR',         'finalizado', fun,  t+timedelta(hours=80)),
        ]
    elif i < 65:
        registros += [
            bita(tid, POL, 'INICIO_PROCESO',    'pendiente',  cli, t),
            bita(tid, POL, 'LLENADO_FORMULARIO','en_proceso', cli, t+timedelta(hours=1)),
            bita(tid, POL, 'SUBIDA_EVIDENCIA',  'en_proceso', cli, t+timedelta(hours=3)),
            bita(tid, POL, 'RECHAZAR',          'rechazado',  fun, t+timedelta(hours=8),
                 {'motivo': 'Garantia insuficiente para monto solicitado'}),
        ]
    else:
        registros += [
            bita(tid, POL, 'INICIO_PROCESO',    'pendiente',  cli, t),
            bita(tid, POL, 'LLENADO_FORMULARIO','en_proceso', cli, t+timedelta(hours=2)),
            bita(tid, POL, 'SUBIDA_EVIDENCIA',  'en_proceso', cli, t+timedelta(hours=4)),
            bita(tid, POL, 'ESCALAR',           'escalado',   fun, t+timedelta(hours=48),
                 {'motivo': 'Excedio SLA', 'prioridad_nueva': 'Alta'}),
            bita(tid, POL, 'RECHAZAR',          'rechazado',  fun, t+timedelta(hours=56),
                 {'motivo': 'Riesgo inaceptable post-escalamiento'}),
        ]

# ============================================================
# 69f3c15e...a7: Flujo rapido (tramites simples, aprobacion directa)
# Dominante: INICIO→LLENADO→APROBAR→FINALIZAR (sin evidencia)
# ============================================================
POL = '69f3c15e806aa96df48515a7'
for i in range(70):
    tid = make_id()
    cli, fun = random.choice(CLIENTES), random.choice(FUNCIONARIOS)
    t = rand_date(d); d += 1
    if i < 60:
        registros += [
            bita(tid, POL, 'INICIO_PROCESO',    'pendiente',  cli, t),
            bita(tid, POL, 'LLENADO_FORMULARIO','en_proceso', cli, t+timedelta(hours=1)),
            bita(tid, POL, 'APROBAR',           'en_revision',fun, t+timedelta(hours=4),
                 {'accion':'APROBAR','tiempo_en_nodo': random.randint(1,4)}),
            bita(tid, POL, 'FINALIZAR',         'finalizado', fun, t+timedelta(hours=random.randint(5,10))),
        ]
    elif i < 66:
        registros += [
            bita(tid, POL, 'INICIO_PROCESO',    'pendiente',  cli, t),
            bita(tid, POL, 'LLENADO_FORMULARIO','en_proceso', cli, t+timedelta(hours=1)),
            bita(tid, POL, 'RECHAZAR',          'rechazado',  fun, t+timedelta(hours=3),
                 {'motivo': 'Fuera de criterios de elegibilidad'}),
        ]
    else:
        registros += [
            bita(tid, POL, 'INICIO_PROCESO',    'pendiente',  cli, t),
            bita(tid, POL, 'LLENADO_FORMULARIO','en_proceso', cli, t+timedelta(hours=1)),
            bita(tid, POL, 'OBSERVAR',          'observado',  fun, t+timedelta(hours=3),
                 {'motivo': 'Dato inconsistente en formulario'}),
            bita(tid, POL, 'LLENADO_FORMULARIO','en_proceso', cli, t+timedelta(hours=24)),
            bita(tid, POL, 'APROBAR',           'en_revision',fun, t+timedelta(hours=28)),
            bita(tid, POL, 'FINALIZAR',         'finalizado', fun, t+timedelta(hours=32)),
        ]

# ============================================================
# 69f3c15e...a8: Flujo con subida multiple de evidencias
# Dominante: INICIO→LLENADO→SUBIDA→SUBIDA→APROBAR→FINALIZAR
# Requiere multiples documentos antes de aprobar
# ============================================================
POL = '69f3c15e806aa96df48515a8'
for i in range(70):
    tid = make_id()
    cli, fun = random.choice(CLIENTES), random.choice(FUNCIONARIOS)
    t = rand_date(d); d += 1
    if i < 55:
        registros += [
            bita(tid, POL, 'INICIO_PROCESO',    'pendiente',  cli, t),
            bita(tid, POL, 'LLENADO_FORMULARIO','en_proceso', cli, t+timedelta(hours=1)),
            bita(tid, POL, 'SUBIDA_EVIDENCIA',  'en_proceso', cli, t+timedelta(hours=3),
                 {'archivo': 'doc1_%s.pdf' % tid[:6]}),
            bita(tid, POL, 'SUBIDA_EVIDENCIA',  'en_proceso', cli, t+timedelta(hours=4),
                 {'archivo': 'doc2_%s.pdf' % tid[:6]}),
            bita(tid, POL, 'APROBAR',           'en_revision',fun, t+timedelta(hours=10),
                 {'accion':'APROBAR','documentos_revisados': 2}),
            bita(tid, POL, 'FINALIZAR',         'finalizado', fun, t+timedelta(hours=random.randint(12,24))),
        ]
    elif i < 63:
        registros += [
            bita(tid, POL, 'INICIO_PROCESO',    'pendiente',  cli, t),
            bita(tid, POL, 'LLENADO_FORMULARIO','en_proceso', cli, t+timedelta(hours=1)),
            bita(tid, POL, 'SUBIDA_EVIDENCIA',  'en_proceso', cli, t+timedelta(hours=3),
                 {'archivo': 'doc1_%s.pdf' % tid[:6]}),
            bita(tid, POL, 'OBSERVAR',          'observado',  fun, t+timedelta(hours=7),
                 {'motivo': 'Falta segundo documento requerido'}),
            bita(tid, POL, 'SUBIDA_EVIDENCIA',  'en_proceso', cli, t+timedelta(hours=30),
                 {'archivo': 'doc2_%s.pdf' % tid[:6]}),
            bita(tid, POL, 'SUBIDA_EVIDENCIA',  'en_proceso', cli, t+timedelta(hours=31),
                 {'archivo': 'doc3_%s.pdf' % tid[:6]}),
            bita(tid, POL, 'APROBAR',           'en_revision',fun, t+timedelta(hours=36),
                 {'accion':'APROBAR','documentos_revisados': 3}),
            bita(tid, POL, 'FINALIZAR',         'finalizado', fun, t+timedelta(hours=44)),
        ]
    else:
        registros += [
            bita(tid, POL, 'INICIO_PROCESO',    'pendiente',  cli, t),
            bita(tid, POL, 'LLENADO_FORMULARIO','en_proceso', cli, t+timedelta(hours=1)),
            bita(tid, POL, 'SUBIDA_EVIDENCIA',  'en_proceso', cli, t+timedelta(hours=3)),
            bita(tid, POL, 'RECHAZAR',          'rechazado',  fun, t+timedelta(hours=8),
                 {'motivo': 'Documentos no cumplen requisitos de autenticidad'}),
        ]

# Insertar
result = db.Bitacora.insert_many(registros)
print('Insertados: %d registros nuevos' % len(result.inserted_ids))
total = db.Bitacora.count_documents({})
print('Total Bitacora ahora: %d' % total)

from collections import Counter
todos = list(db.Bitacora.find({}, {'accion': 1, 'politica_id': 1, '_id': 0}))
print('\nPor politica:')
por_pol = {}
for r in todos:
    pol = r.get('politica_id', 'SIN_POL')
    por_pol[pol] = por_pol.get(pol, 0) + 1
for k, v in sorted(por_pol.items(), key=lambda x: -x[1]):
    print('  %s: %d' % (k, v))

print('\nPor accion:')
dist = Counter(r['accion'] for r in todos)
for k, v in sorted(dist.items(), key=lambda x: -x[1]):
    print('  %-25s %d' % (k, v))

client.close()
