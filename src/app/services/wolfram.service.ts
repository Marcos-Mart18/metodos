import { Injectable } from '@angular/core';
import axios from 'axios';

@Injectable({
  providedIn: 'root',
})
export class WolframService {
  private apiUrl = 'https://api.wolframalpha.com/v2/query';
  private apiKey = '7UWEALKRV4';

  constructor() {}

  // Método para obtener el despeje de una ecuación
  async obtenerDespeje(ecuacion: string): Promise<any> {
    try {
      const response = await axios.get(this.apiUrl, {
        params: {
          input: `solve for x in ${ecuacion}`,
          format: 'plaintext',
          output: 'JSON',
          appid: this.apiKey,
        },
      });

      // Analiza la respuesta
      return response.data.queryresult;
    } catch (error) {
      console.error('Error al obtener despeje de Wolfram Alpha:', error);
      return null;
    }
  }
}
