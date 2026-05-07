import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateOrderDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(512)
  address: string;

  @IsNotEmpty()
  @IsEnum(['online', 'cod'])
  paymentMethod: 'online' | 'cod';
}
