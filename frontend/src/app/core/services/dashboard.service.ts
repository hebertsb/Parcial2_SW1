import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private http = inject(HttpClient);
  private api = environment.apiUrl;

  getMetricas(empresaId: string): Observable<any> {
    return this.http.get<any>(`${this.api}/dashboard/${empresaId}`)
      .pipe(catchError(() => of(null)));
  }
}
