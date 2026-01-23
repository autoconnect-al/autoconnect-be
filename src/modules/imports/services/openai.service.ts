import { Injectable } from '@nestjs/common';

export interface CarDetailFromAI {
  make?: string;
  model?: string;
  variant?: string;
  registration?: number;
  mileage?: number;
  transmission?: string;
  fuelType?: string;
  engineSize?: string;
  drivetrain?: string;
  bodyType?: string;
  price?: number;
}

@Injectable()
export class OpenAIService {
  private readonly apiKey = process.env.OPENAI_API_KEY;
  private readonly apiUrl = 'https://api.openai.com/v1/chat/completions';
  private readonly model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  async generateCarDetails(
    cleanedCaption: string,
  ): Promise<CarDetailFromAI | null> {
    if (!this.apiKey) {
      console.warn(
        'OpenAI API key not configured. Skipping car details generation.',
      );
      return null;
    }

    if (!cleanedCaption || cleanedCaption.trim().length === 0) {
      return null;
    }

    try {
      const prompt = this.buildPrompt(cleanedCaption);

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'system',
              content:
                'You are a car details extraction assistant. Extract car information from text and return it as JSON.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error:', response.status, errorText);
        return null;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        return null;
      }

      // Parse the JSON response
      const carDetails = this.parseCarDetails(content);
      return carDetails;
    } catch (error) {
      console.error('Error generating car details from OpenAI:', error);
      return null;
    }
  }

  private buildPrompt(cleanedCaption: string): string {
    return `
Extract car details from the following text and return ONLY a JSON object with these fields (use null for unknown values):
{
  "make": "manufacturer name",
  "model": "model name",
  "variant": "variant/trim",
  "registration": year as number,
  "mileage": mileage in km as number,
  "transmission": "Manual" or "Automatic",
  "fuelType": "Petrol", "Diesel", "Electric", "Hybrid", or "gas",
  "engineSize": "engine size like 2.0",
  "drivetrain": "FWD", "RWD", "AWD", or "4WD",
  "bodyType": "Sedan", "SUV/Off-Road/Pick-up", "Coupe", "Convertible", "Station Wagon", "Van", "transporter", or "compact",
  "price": price as number (EUR)
}

Text:
${cleanedCaption}

Return ONLY the JSON object, no additional text.
    `.trim();
  }

  private parseCarDetails(content: string): CarDetailFromAI | null {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('No JSON found in OpenAI response');
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]) as CarDetailFromAI;

      // Clean up null values
      const cleaned: CarDetailFromAI = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (value !== null && value !== undefined && value !== '') {
          cleaned[key as keyof CarDetailFromAI] = value;
        }
      }

      return Object.keys(cleaned).length > 0 ? cleaned : null;
    } catch (error) {
      console.error('Error parsing car details from OpenAI response:', error);
      return null;
    }
  }
}
