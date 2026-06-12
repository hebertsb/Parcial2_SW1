from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime, timedelta
import random

client = MongoClient('mongodb+srv://hebertsb08_db_user:g8SspkYSGab87Ecz@cluster0.lbxfuez.mongodb.net/nexusflow_oficial?retryWrites=true&w=majority')
db = client['nexusflow_oficial']

CLIENTES     = ['69dfccb5f663e82412cdba83', '69e1b5b9aa4c12289eae5f4e', '69ec461d122680675cb50c15']
FUNCIONARIOS = ['69dfcc34f663e82412cdba82', '69f02d8aa6889617eac52d84', '69f432e00d822854e1a9317d']
POLITICAS    = ['POL-CREDITO', '69e5761c86717357fbe4a96e', '69f3c15e806aa96df48515a6',
                '69f0f96a1b4f1009733012c7', '69f3c15e806aa96df48515a7', '69f3c15e806aa96df48515a8']
NODOS        = ['Registro de Solicitud', 'Revision de Analista', 'Aprobacion Gerencial',
                'Validacion Documental', 'Verificacion Crediticia', 'Desembolso', 'Cierre']

BASE_DATE = datetime(2026, 3, 1)

def rand_date(offset_days=0, jitter_hours=48):
    return BASE_DATE + timedelta(days=offset_days) + timedelta(hours=random.randint(0, jitter_hours))

def make_id():
    return str(ObjectId())

def bita(tramite_id, politica_id, accion, estado, usuario_id, fecha, detalle=None):
    return {
        'tramite_id': tramite_id,
        'politica_id': politica_id,
        'accion': accion,
        'estado': estado,
        'estado_resultante': estado,
        'usuario_id': usuario_id,
        'fecha_hora': fecha,
        'detalle_ia': detalle or {},
        '_class': 'com.nexusflow.nexusflowbackend.model.Bitacora'
    }

registros = []
day_offset = 0

# PATRON 1: simple aprobacion x35
for _ in range(35):
    tid = make_id()
    pol = random.choice(POLITICAS)
    cli = random.choice(CLIENTES)
    fun = random.choice(FUNCIONARIOS)
    t = rand_date(day_offset, 12)
    day_offset += 1
    n1, n2 = random.sample(NODOS[:4], 2)
    registros += [
        bita(tid, pol, 'INICIO_PROCESO',    'pendiente',  cli, t, {'campos_configurados': random.randint(2,5)}),
        bita(tid, pol, 'LLENADO_FORMULARIO','en_proceso',  cli, t+timedelta(hours=2)),
        bita(tid, pol, 'APROBAR',           'en_revision', fun, t+timedelta(hours=6),
             {'accion':'APROBAR','nodo_origen':n1,'nodo_destino':n2,'tiempo_en_nodo':random.randint(1,24)}),
        bita(tid, pol, 'FINALIZAR',         'finalizado',  fun, t+timedelta(hours=random.randint(8,48))),
    ]

# PATRON 2: con evidencia x20
for _ in range(20):
    tid = make_id()
    pol = random.choice(POLITICAS)
    cli = random.choice(CLIENTES)
    fun = random.choice(FUNCIONARIOS)
    t = rand_date(day_offset, 12)
    day_offset += 1
    archivo = 'doc_%s.pdf' % tid[:8]
    registros += [
        bita(tid, pol, 'INICIO_PROCESO',    'pendiente',  cli, t, {'campos_configurados': random.randint(3,6)}),
        bita(tid, pol, 'LLENADO_FORMULARIO','en_proceso',  cli, t+timedelta(hours=1)),
        bita(tid, pol, 'SUBIDA_EVIDENCIA',  'en_proceso',  cli, t+timedelta(hours=3), {'archivo': archivo}),
        bita(tid, pol, 'APROBAR',           'en_revision', fun, t+timedelta(hours=8),
             {'accion':'APROBAR','tiempo_en_nodo':random.randint(2,20)}),
        bita(tid, pol, 'FINALIZAR',         'finalizado',  fun, t+timedelta(hours=random.randint(10,36))),
    ]

# PATRON 3: con observacion x20
for _ in range(20):
    tid = make_id()
    pol = random.choice(POLITICAS)
    cli = random.choice(CLIENTES)
    fun = random.choice(FUNCIONARIOS)
    t = rand_date(day_offset, 12)
    day_offset += 1
    registros += [
        bita(tid, pol, 'INICIO_PROCESO',    'pendiente',  cli, t, {'campos_configurados': random.randint(2,5)}),
        bita(tid, pol, 'LLENADO_FORMULARIO','en_proceso',  cli, t+timedelta(hours=1)),
        bita(tid, pol, 'OBSERVAR',          'observado',   fun, t+timedelta(hours=5),
             {'motivo':'Documentacion incompleta','tiempo_en_nodo':random.randint(1,8)}),
        bita(tid, pol, 'LLENADO_FORMULARIO','en_proceso',  cli, t+timedelta(hours=24)),
        bita(tid, pol, 'APROBAR',           'en_revision', fun, t+timedelta(hours=30),
             {'accion':'APROBAR','tiempo_en_nodo':random.randint(2,12)}),
        bita(tid, pol, 'FINALIZAR',         'finalizado',  fun, t+timedelta(hours=random.randint(32,60))),
    ]

# PATRON 4: rechazo x12
for _ in range(12):
    tid = make_id()
    pol = random.choice(POLITICAS)
    cli = random.choice(CLIENTES)
    fun = random.choice(FUNCIONARIOS)
    t = rand_date(day_offset, 12)
    day_offset += 1
    registros += [
        bita(tid, pol, 'INICIO_PROCESO',    'pendiente',  cli, t, {'campos_configurados': random.randint(2,4)}),
        bita(tid, pol, 'LLENADO_FORMULARIO','en_proceso',  cli, t+timedelta(hours=2)),
        bita(tid, pol, 'RECHAZAR',          'rechazado',   fun, t+timedelta(hours=6),
             {'motivo':'No cumple requisitos crediticios','tiempo_en_nodo':random.randint(1,6)}),
    ]

# PATRON 5: multi-paso funcionario->cliente->funcionario x15
for _ in range(15):
    tid = make_id()
    pol = random.choice(POLITICAS)
    cli = random.choice(CLIENTES)
    fun1 = random.choice(FUNCIONARIOS)
    other_funcs = [f for f in FUNCIONARIOS if f != fun1]
    fun2 = random.choice(other_funcs) if other_funcs else fun1
    t = rand_date(day_offset, 12)
    day_offset += 1
    n1, n2, n3 = random.sample(NODOS, 3)
    registros += [
        bita(tid, pol, 'INICIO_PROCESO',    'pendiente',  cli,  t, {'campos_configurados': random.randint(3,6)}),
        bita(tid, pol, 'LLENADO_FORMULARIO','en_proceso',  cli,  t+timedelta(hours=1)),
        bita(tid, pol, 'APROBAR',           'en_revision', fun1, t+timedelta(hours=6),
             {'accion':'APROBAR','nodo_origen':n1,'nodo_destino':n2,'tiempo_en_nodo':random.randint(2,18)}),
        bita(tid, pol, 'LLENADO_FORMULARIO','en_proceso',  cli,  t+timedelta(hours=24)),
        bita(tid, pol, 'APROBAR',           'en_revision', fun2, t+timedelta(hours=30),
             {'accion':'APROBAR','nodo_origen':n2,'nodo_destino':n3,'tiempo_en_nodo':random.randint(1,12)}),
        bita(tid, pol, 'FINALIZAR',         'finalizado',  fun2, t+timedelta(hours=random.randint(32,72))),
    ]

# PATRON 6: escalamiento x8
for _ in range(8):
    tid = make_id()
    pol = random.choice(POLITICAS)
    cli = random.choice(CLIENTES)
    fun = random.choice(FUNCIONARIOS)
    t = rand_date(day_offset, 12)
    day_offset += 1
    registros += [
        bita(tid, pol, 'INICIO_PROCESO',    'pendiente',  cli, t, {'campos_configurados': random.randint(2,5)}),
        bita(tid, pol, 'LLENADO_FORMULARIO','en_proceso',  cli, t+timedelta(hours=2)),
        bita(tid, pol, 'ESCALAR',           'escalado',    fun, t+timedelta(hours=72),
             {'motivo':'Excedio tiempo limite SLA','prioridad_nueva':'Alta'}),
        bita(tid, pol, 'APROBAR',           'en_revision', fun, t+timedelta(hours=80),
             {'accion':'APROBAR','tiempo_en_nodo':random.randint(1,6)}),
        bita(tid, pol, 'FINALIZAR',         'finalizado',  fun, t+timedelta(hours=random.randint(82,96))),
    ]

# PATRON 7: complejo obs+evidencia+multi-aprobacion x10
for _ in range(10):
    tid = make_id()
    pol = random.choice(POLITICAS)
    cli = random.choice(CLIENTES)
    fun1 = random.choice(FUNCIONARIOS)
    other_funcs = [f for f in FUNCIONARIOS if f != fun1]
    fun2 = random.choice(other_funcs) if other_funcs else fun1
    t = rand_date(day_offset, 12)
    day_offset += 1
    n1, n2, n3 = random.sample(NODOS, 3)
    registros += [
        bita(tid, pol, 'INICIO_PROCESO',    'pendiente',  cli,  t, {'campos_configurados': random.randint(3,7)}),
        bita(tid, pol, 'LLENADO_FORMULARIO','en_proceso',  cli,  t+timedelta(hours=1)),
        bita(tid, pol, 'OBSERVAR',          'observado',   fun1, t+timedelta(hours=4),
             {'motivo':'Requiere documentacion adicional'}),
        bita(tid, pol, 'SUBIDA_EVIDENCIA',  'en_proceso',  cli,  t+timedelta(hours=26),
             {'archivo': 'evidencia_%s.pdf' % tid[:8]}),
        bita(tid, pol, 'LLENADO_FORMULARIO','en_proceso',  cli,  t+timedelta(hours=27)),
        bita(tid, pol, 'APROBAR',           'en_revision', fun1, t+timedelta(hours=32),
             {'accion':'APROBAR','nodo_origen':n1,'nodo_destino':n2,'tiempo_en_nodo':random.randint(2,10)}),
        bita(tid, pol, 'APROBAR',           'en_revision', fun2, t+timedelta(hours=48),
             {'accion':'APROBAR','nodo_origen':n2,'nodo_destino':n3,'tiempo_en_nodo':random.randint(4,16)}),
        bita(tid, pol, 'FINALIZAR',         'finalizado',  fun2, t+timedelta(hours=random.randint(50,80))),
    ]

result = db.Bitacora.insert_many(registros)
print('Insertados: %d registros' % len(result.inserted_ids))
total = db.Bitacora.count_documents({})
print('Total Bitacora ahora: %d' % total)

from collections import Counter
todos = list(db.Bitacora.find({}, {'accion':1,'_id':0}))
dist = Counter(r['accion'] for r in todos)
print('Distribucion de acciones:')
for k,v in sorted(dist.items(), key=lambda x: -x[1]):
    print('  %s: %d' % (k, v))
client.close()
