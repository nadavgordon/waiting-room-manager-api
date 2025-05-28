import { IsString, IsNotEmpty, IsInt, Min, Max, IsOptional, IsUUID } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsInt()
  @Min(2) // A room should have at least 2 players
  @Max(100) // Arbitrary upper limit for max players
  maxPlayers?: number;

  @IsUUID()
  @IsNotEmpty()
  hostId: string; // Assuming hostId is a UUID
}
