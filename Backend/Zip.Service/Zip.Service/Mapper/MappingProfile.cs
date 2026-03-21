using AutoMapper;
using Zip.Service.DTOs;
using Zip.Service.Models;

namespace Zip.Service.Mapper;

public class MappingProfile : Profile
{
    public MappingProfile()
    {
        ConfigureLevelMappings();
    }

    private void ConfigureLevelMappings()
    {
        CreateMap<LevelDto, Level>()
            .ForMember(dest => dest.GridSize, opt => opt.MapFrom(src => src.Size));

        CreateMap<NumberCellDto, NumberCell>();
        CreateMap<WallBarrierDto, WallBarrier>();

        CreateMap<Level, LevelDto>()
            .ForMember(dest => dest.Size, opt => opt.MapFrom(src => src.GridSize));

        CreateMap<NumberCell, NumberCellDto>();
        CreateMap<WallBarrier, WallBarrierDto>();
    }
}