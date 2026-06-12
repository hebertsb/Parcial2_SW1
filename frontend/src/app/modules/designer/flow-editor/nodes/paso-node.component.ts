import {
  Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit,
  Output, SimpleChanges, Type, ViewChild, ViewContainerRef
} from '@angular/core';
import { Subscription } from 'rxjs';
import { Paso, Formulario } from '../../../../core/models/flujo.models';
import { InicioNodeComponent } from './inicio-node.component';
import { FinNodeComponent } from './fin-node.component';
import { GatewayNodeComponent } from './gateway-node.component';
import { TareaNodeComponent } from './tarea-node.component';

/**
 * Shell de componente dinámico (Dynamic Component Host).
 *
 * En lugar de usar @if/@else-if para decidir qué nodo renderizar,
 * usamos ViewContainerRef.createComponent() para instanciar en tiempo
 * de ejecución la clase correcta según el tipo del paso.
 *
 * Mapa de tipos → componentes:
 *   INICIO  → InicioNodeComponent
 *   FIN     → FinNodeComponent
 *   GATEWAY → GatewayNodeComponent
 *   (resto) → TareaNodeComponent
 */
@Component({
  selector: 'app-paso-node',
  standalone: true,
  template: `<ng-container #host></ng-container>`,
  styles: [':host { display: block; position: relative; }']
})
export class PasoNodeComponent implements OnInit, OnChanges, OnDestroy {
  @Input() paso!: Paso;
  @Input() selected = false;
  @Input() formularios: Formulario[] = [];

  @Output() editar = new EventEmitter<void>();
  @Output() eliminar = new EventEmitter<void>();
  @Output() condicion = new EventEmitter<void>();

  @ViewChild('host', { read: ViewContainerRef, static: true })
  private host!: ViewContainerRef;

  private compRef: any = null;
  private subs: Subscription[] = [];
  private currentTipo = '';

  /** Devuelve la clase del componente a instanciar según el tipo del paso. */
  private resolveNodeType(): Type<any> {
    switch (this.paso?.tipoPaso) {
      case 'INICIO':   return InicioNodeComponent;
      case 'FIN':      return FinNodeComponent;
      case 'GATEWAY':  return GatewayNodeComponent;
      default:         return TareaNodeComponent;
    }
  }

  /** Crea dinámicamente el componente de nodo apropiado. */
  private renderComponent(): void {
    this.subs.forEach(s => s.unsubscribe());
    this.subs = [];
    this.host.clear();

    this.currentTipo = this.paso?.tipoPaso ?? '';
    const nodeType = this.resolveNodeType();

    // Instanciación dinámica: Angular crea el componente en tiempo de ejecución
    this.compRef = this.host.createComponent(nodeType);

    this.compRef.setInput('paso', this.paso);
    this.compRef.setInput('selected', this.selected);
    this.compRef.setInput('formularios', this.formularios);

    // Suscripción a los outputs del componente instanciado dinámicamente
    this.subs.push(
      this.compRef.instance.editar.subscribe(() => this.editar.emit()),
      this.compRef.instance.eliminar.subscribe(() => this.eliminar.emit()),
    );
    if (this.compRef.instance.condicion) {
      this.subs.push(
        this.compRef.instance.condicion.subscribe(() => this.condicion.emit())
      );
    }
  }

  ngOnInit(): void {
    this.renderComponent();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.compRef) return;

    // Si cambió el tipo de nodo, recrear el componente completo
    if (this.paso?.tipoPaso !== this.currentTipo) {
      this.renderComponent();
      return;
    }

    // Si solo cambiaron los inputs, actualizar sin recrear
    this.compRef.setInput('paso', this.paso);
    this.compRef.setInput('selected', this.selected);
    this.compRef.setInput('formularios', this.formularios);
    // Forzar CD en el componente interno — necesario cuando está dentro del canvas foblex
    this.compRef.changeDetectorRef.detectChanges();
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }
}
