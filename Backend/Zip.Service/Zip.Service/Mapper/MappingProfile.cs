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
            .ForMember(dest => dest.GridSize, opt => opt.MapFrom(src => src.Size))
            .ForMember(dest => dest.UserId, opt => opt.Ignore());

        CreateMap<NumberCellDto, NumberCell>();
        CreateMap<WallBarrierDto, WallBarrier>();

        CreateMap<Level, LevelDto>()
            .ForMember(dest => dest.Size, opt => opt.MapFrom(src => src.GridSize))
            .ForMember(dest => dest.OwnerUsername, opt => opt.MapFrom(src => src.User != null ? src.User.Username : null))
            .ForMember(dest => dest.MyBestTimeSeconds, opt => opt.Ignore());

        CreateMap<NumberCell, NumberCellDto>();
        CreateMap<WallBarrier, WallBarrierDto>();
    }
}
