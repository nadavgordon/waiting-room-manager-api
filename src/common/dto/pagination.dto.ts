import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @ApiProperty({
    description: 'Page number for pagination',
    required: false,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({
    description: 'Number of items per page',
    required: false,
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({ description: 'Array of items for the current page' })
  data: T[];

  @ApiProperty({ description: 'Total number of items across all pages' })
  totalItems: number;

  @ApiProperty({ description: 'Number of items on the current page' })
  itemCount: number;

  @ApiProperty({ description: 'Number of items per page' })
  itemsPerPage: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;

  @ApiProperty({ description: 'Current page number' })
  currentPage: number;

  constructor(data: T[], totalItems: number, itemsPerPage: number, currentPage: number) {
    this.data = data;
    this.totalItems = totalItems;
    this.itemCount = data.length;
    this.itemsPerPage = itemsPerPage;
    this.currentPage = currentPage;
    this.totalPages = Math.ceil(totalItems / itemsPerPage);
  }
}