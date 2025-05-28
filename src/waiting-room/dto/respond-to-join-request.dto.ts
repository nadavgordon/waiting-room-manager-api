import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsUUID } from 'class-validator';

export enum JoinRequestDecision {
  APPROVE = 'approve',
  DECLINE = 'decline',
}

export class RespondToJoinRequestDto {
  @ApiProperty({
    description: 'The decision to approve or decline the join request',
    enum: JoinRequestDecision,
    example: JoinRequestDecision.APPROVE,
  })
  @IsNotEmpty()
  @IsEnum(JoinRequestDecision)
  decision: JoinRequestDecision;

  @ApiProperty({
    description: 'The UUID of the host performing the action (TEMPORARY - for use before auth is fully implemented)',
    example: 'a1b2c3d4-e5f6-7890-1234-567890abcdef',
  })
  @IsUUID('4') // Explicitly expect version 4
  @IsNotEmpty()
  hostUserId: string; // TEMPORARY: This should be derived from an authenticated session/token
}
