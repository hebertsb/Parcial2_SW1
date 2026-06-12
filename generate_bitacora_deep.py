from pymongo import MongoClient
from bson import ObjectId
from datetime import datetime, timedelta
import random

client = MongoClient('mongodb+srv://hebertsb08_db_user:g8SspkYSGab87Ecz@cluster0.lbxfuez.mongodb.net/nexusflow_oficial?retryWrites=true&w=majority')
db = client['nexusflow_oficial']

CLIENTES     = ['69dfccb5f663e82412cdba83', '69e1b5b9aa4c12289eae5f4e', '69ec461d122680675cb50c15']
FUNCIONARIOS = ['69dfcc34f663e82412cdba82', '69f02d8aa6889617eac52d84', '69f432e00d822854e1a9317d']
POLITICAS    = ['POL-CREDITO', '69e5761c86717357fbe4a96e', '69f3c15e806aa96df48515a6',
                '69f0f96a1b4f1009733012c7', '69f3c15e806aa96df48515a7']
NODOS        = ['Registro','Analisis','Aprobacion','Validacion','Verificacion','Desembolso','Cierre','Auditoria']

BASE_DATE = datetime(2025, 9, 1)

def rand_date(offset_days=0, jitter=24):
    return BASE_DATE + timedelta(days=offset_days) + timedelta(hours=random.randint(0, jitter))

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
# PATRON L1: Flujo largo aprobacion completa (9 pasos) x30
# Objetivo: secuencias ricas para APROBAR y SUBIDA_EVIDENCIA
# ============================================================
for _ in range(30):
    tid, pol = make_id(), random.choice(POLITICAS)
    cli, fun1 = random.choice(CLIENTES), random.choice(FUNCIONARIOS)
    fun2 = random.choice([f for f in FUNCIONARIOS if f != fun1] or FUNCIONARIOS)
    t = rand_date(d, 12); d += 1
    n1, n2, n3, n4 = random.sample(NODOS, 4)
    registros += [
        bita(tid, pol, 'INICIO_PROCESO',    'pendiente',   cli,  t),
        bita(tid, pol, 'LLENADO_FORMULARIO','en_proceso',  cli,  t+timedelta(hours=1)),
        bita(tid, pol, 'SUBIDA_EVIDENCIA',  'en_proceso',  cli,  t+timedelta(hours=3),
             {'archivo': 'solicitud_%s.pdf' % tid[:6]}),
        bita(tid, pol, 'APROBAR',           'en_revision', fun1, t+timedelta(hours=8),
             {'nodo_origen': n1, 'nodo_destino': n2, 'tiempo_en_nodo': random.randint(2,8)}),
        bita(tid, pol, 'LLENADO_FORMULARIO','en_proceso',  cli,  t+timedelta(hours=24)),
        bita(tid, pol, 'SUBIDA_EVIDENCIA',  'en_proceso',  cli,  t+timedelta(hours=26),
             {'archivo': 'comprobante_%s.pdf' % tid[:6]}),
        bita(tid, pol, 'APROBAR',           'en_revision', fun2, t+timedelta(hours=32),
             {'nodo_origen': n2, 'nodo_destino': n3, 'tiempo_en_nodo': random.randint(4,12)}),
        bita(tid, pol, 'APROBAR',           'en_revision', fun1, t+timedelta(hours=48),
             {'nodo_origen': n3, 'nodo_destino': n4, 'tiempo_en_nodo': random.randint(2,10)}),
        bita(tid, pol, 'FINALIZAR',         'finalizado',  fun1, t+timedelta(hours=random.randint(52,72))),
    ]

# ============================================================
# PATRON L2: Flujo con doble observacion y evidencia (10 pasos) x25
# Objetivo: secuencias ricas para OBSERVAR en contexto largo
# ============================================================
for _ in range(25):
    tid, pol = make_id(), random.choice(POLITICAS)
    cli, fun = random.choice(CLIENTES), random.choice(FUNCIONARIOS)
    t = rand_date(d, 12); d += 1
    n1, n2, n3 = random.sample(NODOS[:6], 3)
    registros += [
        bita(tid, pol, 'INICIO_PROCESO',    'pendiente',  cli, t),
        bita(tid, pol, 'LLENADO_FORMULARIO','en_proceso', cli, t+timedelta(hours=1)),
        bita(tid, pol, 'OBSERVAR',          'observado',  fun, t+timedelta(hours=5),
             {'motivo': 'Documentacion incompleta', 'nodo': n1}),
        bita(tid, pol, 'LLENADO_FORMULARIO','en_proceso', cli, t+timedelta(hours=28)),
        bita(tid, pol, 'SUBIDA_EVIDENCIA',  'en_proceso', cli, t+timedelta(hours=30),
             {'archivo': 'doc1_%s.pdf' % tid[:6]}),
        bita(tid, pol, 'OBSERVAR',          'observado',  fun, t+timedelta(hours=36),
             {'motivo': 'Requiere firma notarial', 'nodo': n2}),
        bita(tid, pol, 'SUBIDA_EVIDENCIA',  'en_proceso', cli, t+timedelta(hours=60),
             {'archivo': 'doc2_%s.pdf' % tid[:6]}),
        bita(tid, pol, 'LLENADO_FORMULARIO','en_proceso', cli, t+timedelta(hours=62)),
        bita(tid, pol, 'APROBAR',           'en_revision',fun, t+timedelta(hours=68),
             {'nodo_origen': n2, 'nodo_destino': n3, 'tiempo_en_nodo': random.randint(2,8)}),
        bita(tid, pol, 'FINALIZAR',         'finalizado', fun, t+timedelta(hours=random.randint(70,90))),
    ]

# ============================================================
# PATRON L3: Escalamiento en flujo largo (10-12 pasos) x25
# Objetivo: ESCALAR en contexto de flujo avanzado, no solo al inicio
# ============================================================
for i in range(25):
    tid, pol = make_id(), random.choice(POLITICAS)
    cli = random.choice(CLIENTES)
    fun1, fun2 = random.sample(FUNCIONARIOS, 2) if len(FUNCIONARIOS) >= 2 else (FUNCIONARIOS[0], FUNCIONARIOS[0])
    t = rand_date(d, 12); d += 1
    n1, n2, n3 = random.sample(NODOS, 3)

    if i < 12:
        # Escalar despues de aprobacion parcial
        registros += [
            bita(tid, pol, 'INICIO_PROCESO',    'pendiente',  cli,  t),
            bita(tid, pol, 'LLENADO_FORMULARIO','en_proceso', cli,  t+timedelta(hours=2)),
            bita(tid, pol, 'SUBIDA_EVIDENCIA',  'en_proceso', cli,  t+timedelta(hours=4),
                 {'archivo': 'eval_%s.pdf' % tid[:6]}),
            bita(tid, pol, 'APROBAR',           'en_revision',fun1, t+timedelta(hours=10),
                 {'nodo_origen': n1, 'nodo_destino': n2}),
            bita(tid, pol, 'LLENADO_FORMULARIO','en_proceso', cli,  t+timedelta(hours=24)),
            bita(tid, pol, 'ESCALAR',           'escalado',   fun1, t+timedelta(hours=96),
                 {'motivo': 'Excedio SLA en segundo nodo', 'prioridad_nueva': 'Alta',
                  'nodo_origen': n2, 'horas_vencidas': random.randint(24,48)}),
            bita(tid, pol, 'APROBAR',           'en_revision',fun2, t+timedelta(hours=104),
                 {'nodo_origen': n2, 'nodo_destino': n3, 'post_escalamiento': True}),
            bita(tid, pol, 'FINALIZAR',         'finalizado', fun2, t+timedelta(hours=112)),
        ]
    else:
        # Doble escalamiento
        registros += [
            bita(tid, pol, 'INICIO_PROCESO',    'pendiente',  cli,  t),
            bita(tid, pol, 'LLENADO_FORMULARIO','en_proceso', cli,  t+timedelta(hours=1)),
            bita(tid, pol, 'APROBAR',           'en_revision',fun1, t+timedelta(hours=8),
                 {'nodo_origen': n1, 'nodo_destino': n2}),
            bita(tid, pol, 'ESCALAR',           'escalado',   fun1, t+timedelta(hours=80),
                 {'motivo': 'Primer vencimiento SLA', 'prioridad_nueva': 'Alta',
                  'escalamiento_numero': 1}),
            bita(tid, pol, 'LLENADO_FORMULARIO','en_proceso', cli,  t+timedelta(hours=82)),
            bita(tid, pol, 'SUBIDA_EVIDENCIA',  'en_proceso', cli,  t+timedelta(hours=84),
                 {'archivo': 'urgente_%s.pdf' % tid[:6]}),
            bita(tid, pol, 'APROBAR',           'en_revision',fun2, t+timedelta(hours=90),
                 {'nodo_origen': n2, 'nodo_destino': n3}),
            bita(tid, pol, 'ESCALAR',           'escalado',   fun2, t+timedelta(hours=160),
                 {'motivo': 'Segundo vencimiento SLA', 'prioridad_nueva': 'Alta',
                  'escalamiento_numero': 2}),
            bita(tid, pol, 'APROBAR',           'en_revision',fun1, t+timedelta(hours=168),
                 {'nodo_origen': n3, 'nodo_destino': NODOS[0], 'post_escalamiento': True}),
            bita(tid, pol, 'FINALIZAR',         'finalizado', fun1, t+timedelta(hours=176)),
        ]

# ============================================================
# PATRON L4: Rechazo tardio en flujo complejo (7-9 pasos) x20
# Objetivo: RECHAZAR despues de multiples aprobaciones y evidencias
# ============================================================
for _ in range(20):
    tid, pol = make_id(), random.choice(POLITICAS)
    cli, fun = random.choice(CLIENTES), random.choice(FUNCIONARIOS)
    t = rand_date(d, 12); d += 1
    n1, n2 = random.sample(NODOS[:5], 2)
    motivo = random.choice([
        'Inconsistencia grave detectada en auditoria final',
        'Garantia valorada insuficiente por perito',
        'Sancion judicial activa descubierta en verificacion',
        'Documentos presentados son falsos segun verificacion',
        'Capacidad de pago deteriorada tras nueva evaluacion',
    ])
    horas_flujo = random.randint(48, 120)
    registros += [
        bita(tid, pol, 'INICIO_PROCESO',    'pendiente',  cli, t),
        bita(tid, pol, 'LLENADO_FORMULARIO','en_proceso', cli, t+timedelta(hours=2)),
        bita(tid, pol, 'SUBIDA_EVIDENCIA',  'en_proceso', cli, t+timedelta(hours=4),
             {'archivo': 'garantia_%s.pdf' % tid[:6]}),
        bita(tid, pol, 'APROBAR',           'en_revision',fun, t+timedelta(hours=10),
             {'nodo_origen': n1, 'nodo_destino': n2, 'tiempo_en_nodo': random.randint(4,12)}),
        bita(tid, pol, 'LLENADO_FORMULARIO','en_proceso', cli, t+timedelta(hours=30)),
        bita(tid, pol, 'SUBIDA_EVIDENCIA',  'en_proceso', cli, t+timedelta(hours=32),
             {'archivo': 'avaluo_%s.pdf' % tid[:6]}),
        bita(tid, pol, 'RECHAZAR',          'rechazado',  fun, t+timedelta(hours=horas_flujo),
             {'motivo': motivo, 'nodo_origen': n2,
              'tiempo_en_nodo': horas_flujo - 32, 'rechazo_tardio': True}),
    ]

# ============================================================
# PATRON L5: Flujo completo 3 funcionarios (12 pasos) x20
# Objetivo: secuencias largas con multiples APROBAR en cadena
# ============================================================
for _ in range(20):
    tid, pol = make_id(), random.choice(POLITICAS)
    cli = random.choice(CLIENTES)
    funs = FUNCIONARIOS[:3] if len(FUNCIONARIOS) >= 3 else FUNCIONARIOS * 3
    f1, f2, f3 = funs[0], funs[1], funs[2]
    t = rand_date(d, 12); d += 1
    n1, n2, n3, n4 = random.sample(NODOS, 4)
    registros += [
        bita(tid, pol, 'INICIO_PROCESO',    'pendiente',  cli, t),
        bita(tid, pol, 'LLENADO_FORMULARIO','en_proceso', cli, t+timedelta(hours=1)),
        bita(tid, pol, 'SUBIDA_EVIDENCIA',  'en_proceso', cli, t+timedelta(hours=3),
             {'archivo': 'solicitud_%s.pdf' % tid[:6]}),
        bita(tid, pol, 'APROBAR',           'en_revision', f1, t+timedelta(hours=8),
             {'nodo_origen': n1, 'nodo_destino': n2, 'funcionario_nivel': 1}),
        bita(tid, pol, 'LLENADO_FORMULARIO','en_proceso', cli, t+timedelta(hours=20)),
        bita(tid, pol, 'APROBAR',           'en_revision', f2, t+timedelta(hours=26),
             {'nodo_origen': n2, 'nodo_destino': n3, 'funcionario_nivel': 2}),
        bita(tid, pol, 'SUBIDA_EVIDENCIA',  'en_proceso', cli, t+timedelta(hours=36),
             {'archivo': 'contrato_%s.pdf' % tid[:6]}),
        bita(tid, pol, 'LLENADO_FORMULARIO','en_proceso', cli, t+timedelta(hours=38)),
        bita(tid, pol, 'APROBAR',           'en_revision', f3, t+timedelta(hours=44),
             {'nodo_origen': n3, 'nodo_destino': n4, 'funcionario_nivel': 3}),
        bita(tid, pol, 'APROBAR',           'en_revision', f1, t+timedelta(hours=52),
             {'nodo_origen': n4, 'nodo_destino': NODOS[-1], 'revision_final': True}),
        bita(tid, pol, 'FINALIZAR',         'finalizado',  f1, t+timedelta(hours=random.randint(54,72))),
    ]

# ============================================================
# PATRON L6: Obs + Escalar + Aprobacion (flujo accidentado, 11 pasos) x15
# Objetivo: combinaciones mixtas que el LSTM necesita aprender
# ============================================================
for _ in range(15):
    tid, pol = make_id(), random.choice(POLITICAS)
    cli, fun = random.choice(CLIENTES), random.choice(FUNCIONARIOS)
    t = rand_date(d, 12); d += 1
    n1, n2, n3 = random.sample(NODOS[:6], 3)
    registros += [
        bita(tid, pol, 'INICIO_PROCESO',    'pendiente',  cli, t),
        bita(tid, pol, 'LLENADO_FORMULARIO','en_proceso', cli, t+timedelta(hours=1)),
        bita(tid, pol, 'OBSERVAR',          'observado',  fun, t+timedelta(hours=6),
             {'motivo': 'Faltan documentos clave', 'nodo': n1}),
        bita(tid, pol, 'SUBIDA_EVIDENCIA',  'en_proceso', cli, t+timedelta(hours=30),
             {'archivo': 'docs_%s.pdf' % tid[:6]}),
        bita(tid, pol, 'LLENADO_FORMULARIO','en_proceso', cli, t+timedelta(hours=32)),
        bita(tid, pol, 'APROBAR',           'en_revision',fun, t+timedelta(hours=38),
             {'nodo_origen': n1, 'nodo_destino': n2}),
        bita(tid, pol, 'LLENADO_FORMULARIO','en_proceso', cli, t+timedelta(hours=50)),
        bita(tid, pol, 'ESCALAR',           'escalado',   fun, t+timedelta(hours=122),
             {'motivo': 'Vencimiento SLA tras observacion previa', 'prioridad_nueva': 'Alta'}),
        bita(tid, pol, 'SUBIDA_EVIDENCIA',  'en_proceso', cli, t+timedelta(hours=130),
             {'archivo': 'adicional_%s.pdf' % tid[:6]}),
        bita(tid, pol, 'APROBAR',           'en_revision',fun, t+timedelta(hours=136),
             {'nodo_origen': n2, 'nodo_destino': n3, 'post_escalamiento': True}),
        bita(tid, pol, 'FINALIZAR',         'finalizado', fun, t+timedelta(hours=140)),
    ]

# Insertar
result = db.Bitacora.insert_many(registros)
print('Insertados: %d registros nuevos' % len(result.inserted_ids))
total = db.Bitacora.count_documents({})
print('Total Bitacora ahora: %d' % total)

from collections import Counter
todos = list(db.Bitacora.find({}, {'accion': 1, '_id': 0}))
dist = Counter(r['accion'] for r in todos)
print('\nDistribucion de acciones:')
for k, v in sorted(dist.items(), key=lambda x: -x[1]):
    print('  %-25s %d' % (k, v))

# Promedio de pasos por tramite
from collections import defaultdict
por_tramite = defaultdict(int)
for r in db.Bitacora.find({}, {'tramite_id': 1}):
    por_tramite[r['tramite_id']] += 1
pasos = list(por_tramite.values())
print('\nPromedio pasos/tramite: %.1f (min %d, max %d)' % (
    sum(pasos)/len(pasos), min(pasos), max(pasos)))
client.close()
